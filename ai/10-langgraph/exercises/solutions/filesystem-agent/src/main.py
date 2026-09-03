from openai import OpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages, Messages
from typing_extensions import Annotated, TypedDict
from .file_utils import get_file_info, list_files

from dotenv import load_dotenv

load_dotenv()
openai_client = OpenAI()

working_directory = "./"  # or "/path/to/your/project"
total_tokens = 0


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    steps_used: int


def call_llm(state: AgentState):
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=str(state),
        tool_choice="auto",
        temperature=0,
        max_completion_tokens=500,
    )
    res = response.choices[0].message
    answer = res.content
    finish_reason = response.choices[0].finish_reason
    total_tokens += response.usage.total_tokens if response.usage else 0


def give_up(state: AgentState):

    pass


def check_iterations(state: AgentState):
    pass


builder = StateGraph(AgentState)

builder.add_node("give_up", give_up)
builder.add_node("check_iterations", check_iterations)
builder.add_node("call_llm", call_llm)
builder.add_node("get_file_info", get_file_info)
builder.add_node("list_files", list_files)

graph = builder.compile()


def main():
    user_query = ""

    result = graph.invoke(
        {
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful file system assistant\n"
                    f"Use tools to perform file and directories operations in directory:{working_directory}\n"
                    "If asked any other thing except file system, file and directory info meta, operations just answer I can't do it",
                },
                {"role": "user", "content": user_query},
            ]
        }
    )
