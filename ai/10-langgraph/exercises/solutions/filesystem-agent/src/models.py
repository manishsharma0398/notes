from pydantic import BaseModel


class ListFileArgs(BaseModel):
    directory: str
    extensions: list[str] = ["*"]
    recursive: bool = False


class FileInfo(BaseModel):
    name: str
    size_bytes: int
    is_file: bool


class GetFileInfoArgs(BaseModel):
    file_path: str


class FileMetadata(BaseModel):
    exists: bool = False
    size_bytes: int = 0
    size_kb: float = 0
    line_count: int = 0
