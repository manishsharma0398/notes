from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a Senior software engineer. Be concise."),
        ("human", "{question}"),
    ]
)


llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.0,
    max_tokens=300,
)

parser = StrOutputParser()

chain = prompt | llm | parser

# result = chain.invoke(({"question": "What is attention in transformer ?"}))

# print(result)

for chunk in chain.stream({"question": "What is attention in transformer ?"}):
    print(chunk, end="", flush=True)
