const http = require("http");
const fs = require('fs');

const port = 8008;
const mongoUri = fs.readFileSync("mongoUri.txt", 'utf8');

const {typeCheck, getPath, keepAlive} = require("./req_processing.js");
const {render, error} = require("./render.js")


function getRequest(req, res)
{
    // Process GET request
    let path = getPath(req);
    console.log(`Get ${path}`);
    let result = typeCheck(path, req, res);
    if (result.error)
    {
        error(result.errorInfo, res, result.acceptHTML);
        return;
    }
    render(path, res, result.acceptHTML);
}


function register(req, res, acceptHTML)
{
    // Process POST request to register.html
    let chunks = [];
    req.on("data", (data)=>{chunks.push(data)});
    req.on("end", ()=>{
        // Convert data into an object
        const data = Buffer.concat(chunks);
        const query = data.toString();
        const parsed = new URLSearchParams(query);
        let formEntries = {}
        for (let pair of parsed.entries())
        {
            formEntries[pair[0]] = pair[1];
        }
        console.log("Register POST request query: ", formEntries)
        // Check if all fields exist and meet the constraint
        let requiredProperties = ["username", "password", "password2"];
        for (let property of requiredProperties)
        {
            if (!formEntries.hasOwnProperty(property))
            {
                error(`${property} not in POST query`, res, acceptHTML);
                return;
            }
        }
        if (formEntries.password.length < 8 || !formEntries.password.match(/[a-zA-Z]/) || !formEntries.password.match(/\d/))
        {
            error("Passwords does not meet requirement", res, acceptHTML);
            return;
        }
        if (formEntries.password !== formEntries.password2)
        {
            error("Passwords do not match", res, acceptHTML);
            return;
        }
        // console.log("Pass validations");
        const client = new MongoClient(uri);

    })
}


function postRequest(req, res)
{
    let path = getPath(req);
    console.log(`Post ${path}`);
    let result = typeCheck(path, req, res);
    if (result.error)
    {
        error(result.errorInfo, res, result.acceptHTML);
        return;
    }
    if (path == "./register.html")
    {
        register(req, res, result.acceptHTML);
    }
    else
    {
        error("Invalid POST request", res, result.acceptHTML);
    }
}

function resolveRequest(req, res)
{
    // Process request
    console.log(`Request arrived: method=${req.method}, url=${req.url}`);
    // console.log(req.headers)
    keepAlive(req, res)
    if (req.method.toUpperCase() == "GET")
    {
        getRequest(req, res);
    }
    else if (req.method.toUpperCase() == "POST")
    {
        postRequest(req, res);
    }

}

const server = http.createServer(resolveRequest);
server.listen(port, ()=>console.log("Server started at ", server.address()));