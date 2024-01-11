const http = require("http");
const events = require('events');
const { MongoClient, ObjectId} = require('mongodb');
const fs = require("fs")
const bcrypt = require("bcrypt")

const {typeCheck, getPath, keepAlive} = require("./req_processing.js");
const {render, error, returnWhole} = require("./render.js");
const {Session, SessionList, checkInactive} = require("./session.js");

const uri = fs.readFileSync("mongoUri.txt", 'utf8');
const port = 8008;
const saltRounds = 10;
// The number of ms after which an session will be considered inactive and terminated. 
const sessionExpiry = 600000;
const client = new MongoClient(uri);



const sessions = new SessionList();

async function recipePage(target, res, acceptHTML, args)
{
    try {
        // console.log("Connecting to database");
        await client.connect();
        // console.log("Connected to database");
        // Insert recipe
        let collection = client.db("recipes").collection("recipe")
        let doc = await collection.findOne({_id:new ObjectId(target)});
        if (!doc)
        {
            error("404 Not Found", res, acceptHTML, args);
        }
        let totalMinutes = doc["duration"];
        doc["durationHours"] = Math.floor(totalMinutes / 60);
        doc["durationMinutes"] = totalMinutes % 60;
        if(doc["public"])
        {
            doc["public"] = "Public"
        }
        else
        {
            if (args["username"] != doc["owner"])
            {
                error("This is a private recipe, you need to log in as the uploader.", res, acceptHTML, args);
                return;
            }
            doc["public"] = "Private"
        }
        let mList = "";
        for (let m of doc["materials"])
        {
            mList = mList.concat(`<li>${m}</li>`);
        }
        doc["materials"] = mList
        let sList = "";
        for (let s of doc["steps"])
        {
            sList = sList.concat(`<li>${s}</li>`);
        }
        doc["steps"] = sList
        args = Object.assign(args, doc);
        render("./templates/recipe.html", res, acceptHTML, args);
    } catch (e) {
        console.log(e);
        error("An unexpected error occured, please try again", res, acceptHTML, args);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }
}

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
    let pathComp = path.split("/");
    if (pathComp.length == 4 && pathComp[2] == "recipe")
    {
        recipePage(pathComp[3], res, result.acceptHTML, args);
        return;
    }
    else if (path == "./templates/logout.html")
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
        render(path, res, result.acceptHTML, args);
        return;
    }
    if (result.type[1] == "html" || (result.type[0] == "*" && result.type[1] == "*"))
    {
        render(path, res, result.acceptHTML, args);
    }
    else
    {
        returnWhole(path, res, result.acceptHTML, args)
    }
    
}


function checkEntries(formEntries, res, acceptHTML, requiredProperties, args)
{
    for (let property of requiredProperties)
    {
        if (!formEntries.hasOwnProperty(property) || !formEntries[property])
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
        args["registerError"] = "Please enter username, password, and reenter password"
        render("templates/register.html", res, acceptHTML, args);
        return;
    }
    if (formEntries.password.length < 8 || !formEntries.password.match(/[a-zA-Z]/) || !formEntries.password.match(/\d/))
    {
        args["registerError"] = "<div class='text-start'>Password do not meet the requirements:\
        \n<ul><li>Password needs to have at least 8 characters</li>\
        \n<li>Password needs to contain at least one letter</li>\
        \n<li>Password needs to contain at least one number</li></ul></div>";
        render("templates/register.html", res, acceptHTML, args);
        return;
    }
    if (formEntries.password !== formEntries.password2)
    {
        args["registerError"] = "Passwords do not match";
        render("templates/register.html", res, acceptHTML, args);
        return;
    }

    try {
        // console.log("Connecting to database");
        await client.connect();
        // console.log("Connected to database");
        // Check wether the username is taken
        let collection = client.db("recipes").collection("users")
        let result = await collection.findOne({"username": formEntries.username});
        if (result)
        {
            args["registerError"] = "Username already exists";
            render("templates/register.html", res, acceptHTML, args);
            return;
        }
        // Hash password
        let insertEntry = {"username": formEntries.username, "favoriteRecipes":[]};
        insertEntry["passwordHash"] = await bcrypt.hash(formEntries.password, saltRounds);
        await collection.insertOne(insertEntry).catch(
            (err)=>{
                args["registerError"] = "An unexpected error occured, please try again."
                console.log(err);
                render("templates/register.html", res, acceptHTML, args);
                return;
            });
        console.log("User inserted");
        args["login"] = true;
        args["username"] = formEntries.username
        render("./templates/home.html", res, acceptHTML, args);
    } catch (e) {
        console.log(e);
        args["registerError"] = "An unexpected error occured, please try again."
        render("templates/register.html", res, acceptHTML, args);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }
    
}

async function login(formEntries, res, acceptHTML, args)
{
    res.statusCode = 200;
    let requiredProperties = ["username", "password"];
    if (!checkEntries(formEntries, res, acceptHTML, requiredProperties, args))
    {
        args["loginError"] = "Please enter username and password";
        render("./templates/home.html", res, acceptHTML, args);
        return;
    }
  
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
            args["username"] = formEntries.username
            res.setHeader("set-cookie", sessions.addSession(formEntries.username));
            render("./templates/home.html", res, acceptHTML, args);
            
        }
        else
        {
            args["loginError"] = "Incorrect username or password";
            render("./templates/home.html", res, acceptHTML, args);
        }
    } catch (e) {
        console.log(e);
        args["loginError"] = "An unexpected error occured, please try again";
        render("./templates/home.html", res, acceptHTML, args);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }

}

async function addRecipe(formEntries, res, acceptHTML, args)
{
    res.statusCode = 200;
    // Check if the user is logged in
    if (!args["login"])
    {
        args["addRecipeError"] = "You need to login before you can upload recipes";
        render("./templates/addRecipe.html", res, acceptHTML, args);
        return;
    }
    // Check if all fields are present and in the required format
    let requiredProperties = ["name", "cuisine", "difficulty", "durationHour", "durationMinute", "materials", "steps"];
    if (!checkEntries(formEntries, res, acceptHTML, requiredProperties, args))
    {
        args["addRecipeError"] = "Please complete all the fields";
        render("./templates/addRecipe.html", res, acceptHTML, args);
        return;
    }
    let hours = parseInt(formEntries["durationHour"]);
    let minutes = parseInt(formEntries["durationMinute"]);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0)
    {
        args["addRecipeError"] = "The duration hours and minutes should be positive integers";
        render("./templates/addRecipe.html", res, acceptHTML, args);
        return;
    }
    // Modify the input format to conform to database schema.
    // Convert duration to pure minutes
    let duration = hours*60 + minutes;
    delete formEntries["durationHour"];
    delete formEntries["durationMinute"];
    formEntries["duration"] = duration;
    if (formEntries.hasOwnProperty("public"))
    {
        formEntries["public"] = true;
    }
    else
    {
        formEntries["public"] = false;
    }
    // Turn materials and steps to array
    if (!Array.isArray(formEntries["materials"]))
    {
        formEntries["materials"] = [formEntries["materials"]]
    }
    if (!Array.isArray(formEntries["steps"]))
    {
        formEntries["steps"] = [formEntries["steps"]]
    }
    // Add owner and favCount
    formEntries["owner"] = args["username"];
    formEntries["favCount"] = 0;
    // console.log("Recipe: ", formEntries)
    try {
        // console.log("Connecting to database");
        await client.connect();
        // console.log("Connected to database");
        // Insert recipe
        let collection = client.db("recipes").collection("recipe")
        await collection.insertOne(formEntries).catch(
            (err)=>{
                args["addRecipeError"] = "An unexpected error occured, please try again."
                console.log(err);
                render("./templates/addRecipe.html", res, acceptHTML, args);
                return;
            });
        console.log("Recipe inserted");
        render("./templates/home.html", res, acceptHTML, args);
    } catch (e) {
        console.log(e);
        args["addRecipeError"] = "An unexpected error occured, please try again";
        render("./templates/addRecipe.html", res, acceptHTML, args);
    } finally {
        await client.close();
        // console.log("Connection closed");
    }
    

}

async function getRecipe(formEntries, res, acceptHTML)
{
    try {
        // Connect to the MongoDB cluster
        console.log("Connecting to DB");
        await client.connect();
        // Make the appropriate DB calls
        console.log(`DB connected`);
        // console.log(args[searchParam][0])
        formEntries["public"] = true;
        let result = await client.db("recipes").collection("recipe").find(formEntries)
        .sort({"favCount":-1}).toArray();
        // console.log(result);
        res.end(JSON.stringify(result));
    } catch (e) {
        console.log("Error: ", e);
        error("An unexpected error occured, please try again", res, acceptHTML);
    } finally {
        await client.close();
        // console.log("End of forEach");
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
        if (req.headers["content-type"] == "application/x-www-form-urlencoded")
        {
            const query = data.toString();
            const parsed = new URLSearchParams(query);
            for (let pair of parsed.entries())
            {
                if (formEntries.hasOwnProperty(pair[0]) && pair[1])
                {
                    if (!Array.isArray(formEntries[pair[0]]))
                    {
                        formEntries[pair[0]] = [formEntries[pair[0]]]
                    }
                    formEntries[pair[0]].push(pair[1])
                    
                }
                else
                {
                    formEntries[pair[0]] = pair[1];
                }
            }
        }
        else if(req.headers["content-type"] == "application/json")
        {
            formEntries = JSON.parse(data.toString());
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
    else if (req.url == "/addRecipe.html")
    {
        addRecipe(formEntries, res, result.acceptHTML, args);
    }
    else if (req.url == "/getRecipe")
    {
        getRecipe(formEntries, res, result.acceptHTML);
    }
    else
    {
        error("404 Not Found. Invalid post request.", res, result.acceptHTML, args);
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