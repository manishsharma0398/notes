"""
Example 3: RAG evaluation with RAGAS
=====================================
Shows how to evaluate a RAG pipeline systematically using the RAGAS framework.
Covers: context_recall, context_precision, faithfulness, answer_relevancy.

Requirements:
  pip install ragas langchain-openai qdrant-client langchain-qdrant datasets

Setup:
  export OPENAI_API_KEY="..."

Note: RAGAS uses an LLM (GPT-4) internally to evaluate faithfulness and
relevancy. This example costs ~$0.05-0.10 in OpenAI credits.
"""

import os
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    context_recall,
    context_precision,
    faithfulness,
    answer_relevancy,
)

# ─── Setup (same as example 2) ───────────────────────────────────────────────

qdrant_client = QdrantClient(":memory:")
qdrant_client.create_collection(
    "docs", vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
)

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = QdrantVectorStore(
    client=qdrant_client, collection_name="docs", embedding=embeddings
)

docs = [
    Document(
        page_content=(
            "Monthly subscribers can cancel at any time from their account settings. "
            "Cancellation takes effect at the end of the current billing period. "
            "No refunds are issued for partial months."
        ),
        metadata={"source": "cancellation_policy.md"},
    ),
    Document(
        page_content=(
            "Annual subscribers who cancel within 14 days of renewal are eligible "
            "for a full refund. After 14 days, no refund is issued for annual plans."
        ),
        metadata={"source": "cancellation_policy.md"},
    ),
    Document(
        page_content=(
            "Enterprise customers have 24/7 priority support with a 4-hour SLA "
            "for P1 issues. Free tier support response time is 72 hours."
        ),
        metadata={"source": "support_sla.md"},
    ),
    Document(
        page_content=(
            "All data is encrypted at rest with AES-256 and in transit with TLS 1.3. "
            "SOC 2 Type II certified."
        ),
        metadata={"source": "security.md"},
    ),
]
vectorstore.add_documents(docs)

retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "Answer using ONLY the context below. "
        "If not in context, say 'I don't have information about that.'\n\nContext:\n{context}",
    ),
    ("human", "{question}"),
])


def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)


# ─── Evaluation Dataset ──────────────────────────────────────────────────────
# A real eval set has 50-100 questions with ground truth answers.
# We use 4 here for demonstration.

EVAL_QUESTIONS = [
    {
        "question": "Can monthly subscribers cancel at any time?",
        "ground_truth": "Yes, monthly subscribers can cancel at any time from account settings. Cancellation takes effect at the end of the current billing period.",
    },
    {
        "question": "Do annual subscribers get a refund if they cancel?",
        "ground_truth": "Annual subscribers who cancel within 14 days of renewal are eligible for a full refund. After 14 days, no refund is issued.",
    },
    {
        "question": "What is the enterprise SLA for P1 issues?",
        "ground_truth": "Enterprise customers have a 4-hour SLA for P1 issues.",
    },
    {
        "question": "What encryption does the platform use?",
        "ground_truth": "Data is encrypted at rest with AES-256 and in transit with TLS 1.3.",
    },
]


# ─── Run evaluation ──────────────────────────────────────────────────────────

def run_evaluation():
    print("[eval] Running RAG pipeline on evaluation questions...")

    eval_data = {
        "question": [],
        "answer": [],
        "contexts": [],
        "ground_truth": [],
    }

    for item in EVAL_QUESTIONS:
        q = item["question"]
        gt = item["ground_truth"]

        # Get retrieved contexts (raw text, not formatted)
        retrieved_docs = retriever.invoke(q)
        contexts = [doc.page_content for doc in retrieved_docs]

        # Get LLM answer
        answer = rag_chain.invoke(q)

        print(f"\nQ: {q}")
        print(f"A: {answer}")
        print(f"Retrieved {len(contexts)} chunks")

        eval_data["question"].append(q)
        eval_data["answer"].append(answer)
        eval_data["contexts"].append(contexts)
        eval_data["ground_truth"].append(gt)

    print("\n[eval] Scoring with RAGAS (this calls GPT-4 internally)...")
    dataset = Dataset.from_dict(eval_data)

    result = evaluate(
        dataset=dataset,
        metrics=[
            context_recall,       # are the ground truth facts in the retrieved chunks?
            context_precision,    # are the retrieved chunks actually relevant?
            faithfulness,         # is the answer grounded in context (not hallucinated)?
            answer_relevancy,     # does the answer address the question?
        ],
    )

    print("\n=== RAGAS Evaluation Results ===")
    print(f"Context Recall:    {result['context_recall']:.3f}  (target: > 0.85)")
    print(f"Context Precision: {result['context_precision']:.3f}  (target: > 0.70)")
    print(f"Faithfulness:      {result['faithfulness']:.3f}  (target: > 0.90)")
    print(f"Answer Relevancy:  {result['answer_relevancy']:.3f}  (target: > 0.80)")

    return result


if __name__ == "__main__":
    run_evaluation()

    print("""
=== What the metrics mean ===

context_recall < 0.85:
  → Your retriever is missing relevant documents
  → Fix: increase k, use hybrid search, tune chunking

context_precision < 0.70:
  → Your retriever is returning irrelevant chunks
  → Fix: use re-ranking, tune similarity threshold

faithfulness < 0.90:
  → LLM is hallucinating beyond the retrieved context
  → Fix: stronger system prompt, reduce k (less confusing context), lower temperature

answer_relevancy < 0.80:
  → LLM answer doesn't actually address the question
  → Fix: improve prompt formatting, check if retrieval failure is causing it
""")
