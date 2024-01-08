const LineByLine = require('line-by-line');
const events = require('events');
const fs = require("fs");
const { MongoClient} = require('mongodb');
const uri = fs.readFileSync("mongoUri.txt", 'utf8');

module.exports.render = render;
module.exports.error = error;
module.exports.image = image;

function errorHeader(res)
{
    res.statusCode = 404;
    res.setHeader("connection", "close");
}

async function parseLine(data, res, type, rl, write, args)
{
    // Process a line of a file and feed it into HTTP response.
    // data is the line
    // res is the HTTP response
    // type is the content-type of the response
    // rl is the read interface
    // write is a flag that indicates whether the current line is in an if block that evaluates to false.
    // {{extend:file}} can be used to load the specified file in place of the instruction
    // {{if:arg}} can be used to load the content between {{if:arg}} and {{endif}} if args[arg] is true 
    // {{for:arg:file}} extend file in a for loop from mongoDB db.collection(args[arg]["collection"]).findOne(args[arg])
    let instructionStart = data.indexOf("{{");
    let instructionEnd = data.indexOf("}}");
    let instruction = [];

    if ( instructionStart != -1 && instructionEnd != -1)
    {
        instruction = data.slice(instructionStart+2, instructionEnd).split(":");
    }
    if (instruction.length == 1)
    {
        if (instruction[0] == "endif")
        {
            if (write < 0)
            {
                return 1;
            }
            else
            {
                return 0;
            }
        }
    }
    else if (instruction.length == 2)
    {
        if(write < 0 && (instruction[0] == "if" || instruction[0] == "ifnot"))
        {
            return -1;
        }
        else if(write < 0)
        {
            return 0;
        }
        if (instruction[0] == "extend")
        {
            rl.pause()
            await render(instruction[1], res, type, args, true);     
            rl.resume();
            return 0; 
        }
        else if (instruction[0] == "if")
        {
            if (!args || !args.hasOwnProperty(instruction[1])||!args[instruction[1]])
            {
                return -1;
            }
            else
            {
                return 0;
            }
        }
        else if(instruction[0] == "ifnot")
        {
            if (!args || !args.hasOwnProperty(instruction[1])||!args[instruction[1]])
            {
                return 0;
            }
            else
            {
                return -1;
            }
        }
        else if(instruction[0] == "replace")
        {
            let replacement = ""
            if (args && args.hasOwnProperty(instruction[1]))
            {
                replacement = args[instruction[1]]
            }
            res.write(data.slice(0,instructionStart)+replacement+data.slice(instructionEnd+2));
            res.write("\r\n");
            return 0;
        }
        else 
        {
            res.write(data);
            res.write("\r\n");
            return 0;
        }
    }
    else
    {
        if (write < 0)
        {
            return 0;
        }
        if (instruction.length == 3 && instruction[0] == "for")
        {
            if (args[instruction[1]])
            {
                rl.pause();
                await forEach(instruction[2], res, type, instruction[1], args)
                rl.resume();
            }
            return 0
        }
        res.write(data);
        res.write("\r\n");
        return 0;
    }
}


async function render(path, res, type, args=null, recurring=false, callByError=false)
{   
    // Render file and send it as HTTP response
    // path is the path to the file to be rendered
    // type is the MIME content-type for the response
    // args contains the various arguments used for rendering html
    // recurring indicates whether this render function is called by another render function
    
    console.log("Trying to render: ", path, ". Recurring = ", recurring);
    console.log("Args: ", args);
    let write = 0;

    try{
        let rl = new LineByLine(path);

        rl.on("line", (data)=>{
            // console.log(data);
            parseLine(data, res, type, rl, write, args).then((val)=>{write+=val});
        });

        rl.on("end", (data)=>{
            console.log("Finished rendering: ", path, ". Recurring = ", recurring);
            if (!recurring)
            {
                console.log("Response sent");
                res.statusCode = 200;
                res.end(data);
            }
        })
        await events.once(rl, 'end');
    } catch(err)
    {
        error("404 not found", res, type, args, callByError);
    }    
    
}

async function error(err, res, type, args=null, cyclic=false)
{
    // err = Error information
    // res = Response object
    // Type = True if HTML is accepted, false otherwise
    // args contains the various arguments used for rendering html
    // cyclic is used to handle the case where an error occurs when rendering 404.html and one error function invokes another error function.
    console.log(`Error trigger: ${err}`);
    errorHeader(res)
    if (cyclic || !type)
    {
        console.log("Response sent");
        res.end(err);
        return;
    }
    else
    {
        args["error"] = err;
        await render("templates/404.html", res, type, args, false, true);
    }

}


function image(path, res, acceptHTML, args)
{
    fs.readFile(path, (err, content)=>{
        if (err)
        {
            error(err, res, acceptHTML, args);
        }
        else
        {
            res.end(content);
        }  
    })
}

async function forEach(path, res, type, searchParam, args)
{
    // path = the file path to be rendered
    // searchParam = the property name of args that store the searchParam
    // args = All the arguments for rendering
    const client = new MongoClient(uri);
    // console.log("forEach: ", path)
    try {
        // Connect to the MongoDB cluster
        await client.connect();
        // Make the appropriate DB calls
        // console.log(`Connected: ${args[searchParam][1]}`)
        // console.log(args[searchParam][0])
        let result = client.db("recipes").collection(args[searchParam][1]).find(args[searchParam][0]);
        for await (let doc of result)
        {
            if (doc.hasOwnProperty("duration"))
            {
                let totalMinutes = doc["duration"];
                doc["durationHours"] = Math.floor(totalMinutes / 60);
                doc["durationMinutes"] = totalMinutes % 60;
            }
            let newArgs = Object.assign(args, doc);
            await render(path, res, type, newArgs, true);
            // console.log(doc);
        }

    } catch (e) {
        console.log("Error: ", e);
    } finally {
        await client.close();
        // console.log("End of forEach");
    }
}