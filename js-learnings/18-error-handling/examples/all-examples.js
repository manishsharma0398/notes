// Chapter 18: Error Handling
try {
    throw new Error("Test");
} catch (e) {
    console.log(e.message);
} finally {
    console.log("Finally");
}

// Async errors
async function test() {
    try {
        await Promise.reject("error");
    } catch (e) {
        console.log("Caught:", e);
    }
}
