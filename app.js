const http = require("http");
const events = require('events');
const { MongoClient} = require('mongodb');
const fs = require("fs")
const bcrypt = require("bcrypt")

const uri = fs.readFileSync("mongoUri.txt", 'utf8');
const port = 8008;
const saltRounds = 10;

const {typeCheck, getPath, keepAlive} = require("./req_processing.js");
const {render, error, image} = require("./render.js")

class Session {
    // A session variable for maintaining a user's session.
    constructor (username)
    {
        this.username = username;
        this.secret = Math.round(Math.random() * 1000000).toString();
    }

    createCookie ()
    {
        return [secureCookie("username", this.username), secureCookie("secret", this.secret)];
    }
}

function secureCookie(name, val)
{
    return `${name}=${val}; HttpOnly`;
}


function getRequest(req, res)
{
    // Process GET request
    let path = getPath(req);
    console.log(`Get ${path}`);
    let result = typeCheck(req, res);
    if (result.error)
    {
        error(result.errorInfo, res, result.acceptHTML);
        return;
    }
    if (result.type[0] == "image")
    {
        image(path, res, result.acceptHTML)
        return;
    }
    render(path, res, result.acceptHTML);
}


function checkEntries(formEntries, res, acceptHTML, requiredProperties)
{
    for (let property of requiredProperties)
    {
        if (!formEntries.hasOwnProperty(property))
        {
            error(`${property} not in POST query`, res, acceptHTML);
            return false;
        }
    }
    return true;
}

async function register(formEntries, res, acceptHTML)
{
    res.statusCode = 200;
    // Check if all fields exist and meet the constraint
    let requiredProperties = ["username", "password", "password2"];
    if (!checkEntries(formEntries, res, acceptHTML, requiredProperties))
    {
        return;
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
    
    // Connect to database
    const client = new MongoClient(uri);

    try {
        // console.log("Connecting to database");
        await client.connect();
        // console.log("Connected to database");
        // Check wether the username is taken
        let collection = client.db("recipes").collection("users")
        let result = await collection.findOne({"username": formEntries.username});
        if (result)
        {
            error("Username already exists", res, acceptHTML);
            return;
        }
        // Hash password
        let insertEntry = {"username": formEntries.username};
        insertEntry["passwordHash"] = await bcrypt.hash(formEntries.password, saltRounds);
        await collection.insertOne(insertEntry).catch(
            (err)=>{
                error(err, res, acceptHTML);
                return;
            });
        console.log("User inserted");
        render("./templates/home.html", res, acceptHTML);
    } catch (e) {
        error(e, res, acceptHTML);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }
    
}

async function login(formEntries, res, acceptHTML)
{
    res.statusCode = 200;
    let requiredProperties = ["username", "password"];
    if (!checkEntries(formEntries, res, acceptHTML, requiredProperties))
    {
        return;
    }
    // Connect to database
    const client = new MongoClient(uri);
  
    try {
        // console.log("Connecting to database");
        await client.connect();
        // console.log("Connected to database");
        // Check wether the username exists
        let collection = client.db("recipes").collection("users")
        let storedUser = await collection.findOne({"username": formEntries.username});
        if (!storedUser)
        {
            error("Username does not exists", res, acceptHTML);
            return;
        }
        // Compare entered password with hash
        let compResult = await bcrypt.compare(formEntries["password"], storedUser["passwordHash"])
        if (compResult)
        {
            console.log("Correct login credential");
            render("./templates/home.html", res, acceptHTML, {login:true});
            let session = new Session(formEntries.username);
            res.setHeader("set-cookie", session.createCookie());
        }
        else
        {
            error("Incorrect login credential", res, acceptHTML);
        }
    } catch (e) {
        error(e, res, acceptHTML);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }

}

async function postRequest(req, res)
{
    console.log(`Post ${req.url}`);
    let result = typeCheck(req, res);
    if (result.error)
    {
        error(result.errorInfo, res, result.acceptHTML);
        return;
    }

    // Process POST request
    let chunks = [];
    let formEntries = {}
    req.on("data", (data)=>{chunks.push(data)});
    req.on("end", ()=>{
        // Convert data into an object
        const data = Buffer.concat(chunks);
        const query = data.toString();
        const parsed = new URLSearchParams(query);
        for (let pair of parsed.entries())
        {
            formEntries[pair[0]] = pair[1];
        }
        console.log("POST request query: ", formEntries)
    })
    await events.once(req, 'end');

    if (req.url == "/register.html")
    {
        register(formEntries, res, result.acceptHTML);
    }
    else if (req.url == "/")
    {
        login(formEntries, res, result.acceptHTML);
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