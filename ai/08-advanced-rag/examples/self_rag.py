"""
self_rag.py — Self-RAG: Conditional Retrieval + Faithfulness Grading

Demonstrates:
  - Retrieval decision gate (does this query need docs?)
  - Chunk relevance filtering (per-chunk grader)
  - Faithfulness check post-generation
  - Cost vs. quality tradeoff in practice

Run:
  pip install langchain langchain-openai langchain-community faiss-cpu pydantic
  OPENAI_API_KEY=... python self_rag.py
"""

import os
from pydantic import BaseModel, Field
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

docs = [
    Document(page_content="Enterprise plan: $299/month. Includes SSO, custom SLA, and dedicated support.", metadata={"source": "pricing.md"}),
    Document(page_content="Pro plan: $49/month. Includes 10 team members, 100k API calls/mo.", metadata={"source": "pricing.md"}),
    Document(page_content="All plans include 30-day money-back guarantee.", metadata={"source": "refunds.md"}),
    Document(page_content="EU customers are subject to GDPR data residency options available on Enterprise plan.", metadata={"source": "gdpr.md"}),
]

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

vectorstore = FAISS.from_documents(docs, embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# ── Grader 1: Should we retrieve? ─────────────────────────────────────────────
class RetrievalDecision(BaseModel):
    should_retrieve: bool = Field(description="True if proprietary/specific info needed")
    reasoning: str = Field(description="One sentence explanation")

retrieval_grader = ChatPromptTemplate.from_template(
    """Decide if this question needs retrieval from a company knowledge base.
Retrieval NEEDED: company policies, product details, pricing, SLA terms.
Retrieval NOT needed: math, general coding, public knowledge, chitchat.

Question: {question}"""
) | llm.with_structured_output(RetrievalDecision)

# ── Grader 2: Is this chunk relevant? ─────────────────────────────────────────
class ChunkRelevance(BaseModel):
    is_relevant: bool = Field(description="True if chunk contains useful info for the question")

relevance_grader = ChatPromptTemplate.from_template(
    """Is this document chunk relevant for answering the question?
Be strict — only mark relevant if it directly helps answer the question.

Question: {question}
Chunk: {chunk}"""
) | llm.with_structured_output(ChunkRelevance)

# ── Grader 3: Is the answer faithful? ─────────────────────────────────────────
class FaithfulnessGrade(BaseModel):
    is_faithful: bool = Field(description="True if every claim is supported by context")
    unsupported_claims: list[str] = Field(default=[], description="Claims not in context")

faithfulness_grader = ChatPromptTemplate.from_template(
    """Is every factual claim in the answer directly supported by the provided context?
Mark as NOT faithful if ANY claim comes from outside the context.

Context: {context}
Answer: {answer}"""
) | llm.with_structured_output(FaithfulnessGrade)

# ── Self-RAG pipeline ─────────────────────────────────────────────────────────
def self_rag(query: str) -> dict:
    print(f"\n{'='*60}")
    print(f"Query: {query}")

    # Step 1: Should we retrieve?
    decision = retrieval_grader.invoke({"question": query})
    print(f"\n[1] Retrieve? {decision.should_retrieve} — {decision.reasoning}")

    if not decision.should_retrieve:
        answer = llm.invoke(query).content
        return {"answer": answer, "retrieved": False, "steps": 1}

    # Step 2: Retrieve
    raw_docs = retriever.invoke(query)
    print(f"\n[2] Retrieved {len(raw_docs)} chunks")

    # Step 3: Grade relevance per chunk
    relevant_docs = []
    for i, doc in enumerate(raw_docs):
        grade = relevance_grader.invoke({"question": query, "chunk": doc.page_content})
        status = "✓ relevant" if grade.is_relevant else "✗ irrelevant"
        print(f"    Chunk {i+1}: {status} — {doc.page_content[:60]}...")
        if grade.is_relevant:
            relevant_docs.append(doc)

    if not relevant_docs:
        return {"answer": "I don't have relevant information about that.", "retrieved": True, "chunks_used": 0}

    # Step 4: Generate
    context = "\n\n---\n\n".join(
        f"[{doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in relevant_docs
    )
    answer_prompt = f"Answer using ONLY the context below. If info isn't in context, say so.\n\nContext:\n{context}\n\nQuestion: {query}\nAnswer:"
    answer = llm.invoke(answer_prompt).content
    print(f"\n[4] Generated answer: {answer[:120]}...")

    # Step 5: Faithfulness check
    faith = faithfulness_grader.invoke({"context": context, "answer": answer})
    print(f"\n[5] Faithful: {faith.is_faithful}")
    if faith.unsupported_claims:
        print(f"    Unsupported claims: {faith.unsupported_claims}")

    return {
        "answer": answer,
        "retrieved": True,
        "chunks_used": len(relevant_docs),
        "faithful": faith.is_faithful,
        "warnings": faith.unsupported_claims
    }

# ── Test cases ────────────────────────────────────────────────────────────────
test_queries = [
    "What is 15% of 240?",                           # Should NOT retrieve (math)
    "What is the Enterprise plan price?",             # Should retrieve — specific product info
    "What are the pricing differences between Pro and Enterprise for EU customers?",  # Complex
]

for query in test_queries:
    result = self_rag(query)
    print(f"\nFinal answer: {result['answer']}")
    print(f"Retrieved: {result['retrieved']} | Chunks used: {result.get('chunks_used', 'N/A')}")

print("""
What to observe:
  - "15% of 240" skips retrieval entirely (saves embed + vector search cost)
  - Enterprise price query: only the pricing chunk is marked relevant, not refund/GDPR chunks
  - Complex query: multiple chunks marked relevant, answer synthesizes them
  - Faithfulness grader catches if the LLM adds anything not in context

Cost reality:
  - Math query:     0 retrieval, 1 generation  = 2 LLM calls total
  - Simple query:   1 retrieval, 4 graders, 1 generation, 1 faith = 7 calls
  - Complex query:  same but more relevant chunks → same 7 calls

This is why Self-RAG is selective, not universal.
""")
