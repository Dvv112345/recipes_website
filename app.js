const http = require("http");
const events = require('events');
const { MongoClient} = require('mongodb');
const fs = require("fs")
const bcrypt = require("bcrypt")

const uri = fs.readFileSync("mongoUri.txt", 'utf8');
const port = 8008;
const saltRounds = 10;
// The number of ms after which an session will be considered inactive and terminated. 
const sessionExpiry = 600000;

const {typeCheck, getPath, keepAlive} = require("./req_processing.js");
const {render, error, image} = require("./render.js");
const {Session, SessionList, checkInactive} = require("./session.js");

const sessions = new SessionList();

async function getRequest(req, res, args)
{
    // Process GET request
    let {path, searchParam} = getPath(req);
    console.log(`Get ${path}`);
    let result = typeCheck(req, res);
    if (result.error)
    {
        error(result.errorInfo, res, result.acceptHTML, args);
        return;
    }
    if (path == "./templates/logout.html")
    {
        let cookieMessage = sessions.removeSession(args["sessionID"]);
        if (cookieMessage)
        {
            res.setHeader("set-cookie", cookieMessage);
            args["login"] = false;
        }
        path = "./templates/home.html";
    }
    if (path == "./templates/home.html")
    {
        searchParam["public"] = true;
        args["recipes"] = [searchParam, "recipe"];
        render(path, res, result.acceptHTML, args);
        return;
    }
    if (result.type[0] == "image")
    {
        image(path, res, result.acceptHTML, args)
        return;
    }
    render(path, res, result.acceptHTML, args);
}


function checkEntries(formEntries, res, acceptHTML, requiredProperties, args)
{
    for (let property of requiredProperties)
    {
        if (!formEntries.hasOwnProperty(property))
        {
            return false;
        }
    }
    return true;
}

async function register(formEntries, res, acceptHTML, args)
{
    res.statusCode = 200;
    // Check if all fields exist and meet the constraint
    let requiredProperties = ["username", "password", "password2"];
    if (!checkEntries(formEntries, res, acceptHTML, requiredProperties, args))
    {
        args["registerError"] = "<div class='text-center alert alert-danger'>\
        Please enter username, password, and reenter password</div>"
        render("templates/register.html", res, acceptHTML, args);
        return;
    }
    if (formEntries.password.length < 8 || !formEntries.password.match(/[a-zA-Z]/) || !formEntries.password.match(/\d/))
    {
        args["registerError"] = "<div class='text-left alert alert-danger'>\
        \nPassword do not meet the requirements:\
        \n<ul><li>Password needs to have at least 8 characters</li>\
        \n<li>Password needs to contain at least one letter</li>\
        \n<li>Password needs to contain at least one number</li></ul></div>";
        render("templates/register.html", res, acceptHTML, args);
        return;
    }
    if (formEntries.password !== formEntries.password2)
    {
        args["registerError"] = "<div class='text-center alert alert-danger'>\
        Passwords do not match</div>";
        render("templates/register.html", res, acceptHTML, args);
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
            args["registerError"] = "<div class='text-center alert alert-danger'>\
            Username already exists</div>";
            render("templates/register.html", res, acceptHTML, args);
            return;
        }
        // Hash password
        let insertEntry = {"username": formEntries.username, "favoriteRecipes":[]};
        insertEntry["passwordHash"] = await bcrypt.hash(formEntries.password, saltRounds);
        await collection.insertOne(insertEntry).catch(
            (err)=>{
                args["registerError"] = "<div class='text-center alert alert-danger'>\
                Unexpected error occured, please try again.</div>"
                console.err(err);
                render("templates/register.html", res, acceptHTML, args);
                return;
            });
        console.log("User inserted");
        args["login"] = true;
        args["username"] = formEntries.username
        args["recipes"] = [{"public":true}, "recipe"];
        render("./templates/home.html", res, acceptHTML, args);
    } catch (e) {
        error(e, res, acceptHTML, args);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }
    
}

async function login(formEntries, res, acceptHTML, args)
{
    res.statusCode = 200;
    let requiredProperties = ["username", "password"];
    args["recipes"] = [{"public":true}, "recipe"];
    if (!checkEntries(formEntries, res, acceptHTML, requiredProperties, args))
    {
        args["loginError"] = "Please enter username and password";
        render("./templates/home.html", res, acceptHTML, args);
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
            args["loginError"] = "Incorrect username or password";
            render("./templates/home.html", res, acceptHTML, args);
            return;
        }
        // Compare entered password with hash
        let compResult = await bcrypt.compare(formEntries["password"], storedUser["passwordHash"])
        if (compResult)
        {
            console.log("Correct login credential");
            args["login"] = true;
            args["formEntries"] = formEntries.username
            res.setHeader("set-cookie", sessions.addSession(formEntries.username));
            args["recipes"] = [{"public":true}, "recipe"];
            render("./templates/home.html", res, acceptHTML, args);
            
        }
        else
        {
            args["loginError"] = "Incorrect username or password";
            render("./templates/home.html", res, acceptHTML, args);
        }
    } catch (e) {
        args["loginError"] = "Unexpected error, please try again";
        render("./templates/home.html", res, acceptHTML, args);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }

}

async function postRequest(req, res, args)
{
    console.log(`Post ${req.url}`);
    let result = typeCheck(req, res);
    if (result.error)
    {
        error(result.errorInfo, res, result.acceptHTML, args);
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
        register(formEntries, res, result.acceptHTML, args);
    }
    else if (req.url == "/")
    {
        login(formEntries, res, result.acceptHTML, args);
    }
    else
    {
        error("Invalid POST request", res, result.acceptHTML, args);
    }
}

function resolveRequest(req, res)
{
    // Process request
    console.log(`Request arrived: method=${req.method}, url=${req.url}`);
    console.log("Cookies:", req.headers.cookie);
    keepAlive(req, res)
    let args = sessions.validateSession(req.headers.cookie, res);
    if (req.method.toUpperCase() == "GET")
    {
        getRequest(req, res, args);
    }
    else if (req.method.toUpperCase() == "POST")
    {
        postRequest(req, res, args);
    }
}

const server = http.createServer(resolveRequest);
server.listen(port, ()=>console.log("Server started at ", server.address()));
let timer = setInterval(checkInactive, sessionExpiry, sessions);