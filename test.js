const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const asyncFunc = async (delay, id) => {
    console.log(`Fetching data, id: ${id}`)
    await sleep(delay)
    console.log(`Data Fetched, id: ${id}`)
    return {data: "some data", id}
}



const main = async () => {
    let task1 = asyncFunc(2, 1)
    let task2 = asyncFunc(2, 2)

    const result1 = await task1
    console.log("Recieved result1", result1)

    const result2 = await task2
    console.log("Recieved result2", result2)

    
}

main()