const { MongoClient} = require('mongodb');

const uri = "mongodb+srv://dvv112345:12345@cluster0.d8dgckj.mongodb.net/?retryWrites=true&w=majority";

async function main(){
    const client = new MongoClient(uri);

    try {
        // Connect to the MongoDB cluster
        await client.connect();

        // Make the appropriate DB calls
        let result = client.db("recipes").collection("users").find();
        // result.then(console.log);
        for await (const doc of result)
        {
            console.log(doc);
        }

    } catch (e) {
        console.error("Error: ", e);
    } finally {
        await client.close();
    }
}

main().catch(console.error);