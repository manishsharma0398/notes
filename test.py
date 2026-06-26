import asyncio

async def asyncFunc(delay, id):
    print(f"Fetching data, id: {id}")
    await asyncio.sleep(delay)
    print(f"Data Fetched, id: {id}")
    return {"data": "some data", "id": id}

async def main():
    # task1 = asyncFunc(2, 1)
    # task2 = asyncFunc(2, 2)

    result1 = await  asyncFunc(2, 1)
    print(f"Recieved result1, {result1}")

    result2 = await  asyncFunc(2, 2)
    print(f"Recieved result2, {result2}")

    

asyncio.run(main())