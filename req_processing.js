const http = require("http");
const url = require("url");
const mime = require("mime-types")

module.exports.typeCheck = typeCheck;
module.exports.getPath = getPath;
module.exports.keepAlive = keepAlive;


function typeCheck(req, res)
{
    // Check if the content-type we are expected to return based on the path is accepted and set content-type.
    // Return an object with three properties:
    // error that specifies whether the MIME type matches expected MIME type
    // acceptHTML that specifies whether HTML type is expected. 
    // expectedType that contain an array of the two parts of MIME type.
    let expectedType = mime.lookup(req.url);
    if (!expectedType)
    {
        expectedType = "*/*";
    }
    let parts = expectedType.split("/");
    let result = {"type":parts}
    if (req.headers.accept.indexOf(expectedType) != -1 || 
    req.headers.accept.indexOf("*/*") != -1 || req.headers.accept.indexOf(`${parts[0]}/*`) != -1)
    {
        res.setHeader("content-type", expectedType);
        result.error = false;
    }
    else
    {
        result.errorInfo = `Error: expected to return MIME type ${expectedType} but it is not accepted`
        res.setHeader("content-type", "text/plain")
        result.error = true;
    }
    if (req.headers.accept.indexOf("*/*") != -1 || req.headers.accept.indexOf("text/html") != -1)
    {
        result.acceptHTML = true;
    }
    else
    {
        result.acceptHTML = false;
    }
    return result;
}

function getPath(req)
{
    let reqURL = req.url;
    if (reqURL == "/")
    {
        reqURL = "/home.html";
    }
    // console.log(req.headers);
    reqURL = new url.URL(reqURL, "http://placeholder");
    let path = "./templates"+reqURL.pathname;
    if (path.indexOf("..")!=-1)
    {
        path = "./templates/home.html";
    }
    let searchParams = reqURL.searchParams;
    const dataObj = {}
    for (let pair of searchParams)
    {
        dataObj[pair[0]] = pair[1];
    }
    return {"path": path, "searchParam": dataObj};
}

function keepAlive(req, res)
{
    if (req.headers.hasOwnProperty("connection"))
    {
        res.setHeader("connection", req.headers.connection);
    }
    else
    {
        res.setHeader("connection", "close");
    }
    
}

