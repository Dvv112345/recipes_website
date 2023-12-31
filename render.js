const LineByLine = require('line-by-line');
const events = require('events');

module.exports.render = render;
module.exports.error = error;

function errorHeader(res)
{
    res.statusCode = 404;
    res.setHeader("connection", "close");
}

async function parseLine(data, res, type, rl)
{
    // Process a line of a file and feed it into HTTP response.
    // data is the line
    // res is the HTTP response
    // type is the content-type of the response
    // rl is the read interface
    // {{extend:file}} can be used to load the specified file in place of the instruction
    let instructionStart = data.indexOf("{{");
    let instructionEnd = data.indexOf("}}");        

    if ( instructionStart != -1 && instructionEnd != -1)
    {
        rl.pause()
        let instruction = data.slice(instructionStart+2, instructionEnd).split(":");
        if (instruction[0] == "extend")
        {
            await render(instruction[1], res, type, true);  
            rl.resume();         
        }
        // console.log(instruction);
    }
    else
    {
        res.write(data);
        res.write("\r\n");
    }
}


async function render(path, res, type, recurring=false, callByError=false)
{   
    // Render file and send it as HTTP response
    // path is the path to the file to be rendered
    // type is the MIME content-type for the response
    // recurring indicates whether this render function is called by another render function
    
    console.log("Trying to render: ", path, ". Recurring = ", recurring);

    try{
        let rl = new LineByLine(path);

        rl.on("line", (data)=>{
            parseLine(data, res, type, rl).then();
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
        error(err, res, type, callByError);
    }    
    
}

async function error(err, res, type, cyclic=false)
{
    // err = Error information
    // res = Response object
    // Type = True if HTML is accepted, false otherwise
    // cyclic is used to handle the case where an error occurs when rendering 404.html and one error function invokes another error function.
    console.log(`Error trigger: ${err}`);
    errorHeader(res)
    if (cyclic || !type)
    {
        console.log("Response sent");
        res.end();
        return;
    }
    else
    {
        await render("404.html", res, type, false, true);
    }

}