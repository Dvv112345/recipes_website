const { MongoClient} = require('mongodb');
const fs = require("fs")

const uri = fs.readFileSync("mongoURL.txt", 'utf8');

async function main(){
    const client = new MongoClient(uri);

    try {
        console.log("Connecting");
        // Connect to the MongoDB cluster
        await client.connect();
        console.log("Connected");
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