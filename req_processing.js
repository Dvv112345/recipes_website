const http = require("http");
const url = require("url");
const mime = require("mime-types")

module.exports.typeCheck = typeCheck;
module.exports.getPath = getPath;
module.exports.keepAlive = keepAlive;
module.exports.errorHeader = errorHeader;


function typeCheck(path, req, res)
{
    // Check if the content-type we are expected to return based on the path is accepted and set content-type.
    // Return -1 if the expected content-type is not accepted
    // Return 0 if the expected content-type is accepted but html is not accepted
    // Return 1 if the expected content-type is accepted and html is accepted
    let expectedType = mime.lookup(path);
    let result = {}
    console.log("Expected type is: ", expectedType)
    if (req.headers.accept.indexOf(expectedType) != -1 || req.headers.accept.indexOf("*/*") != -1)
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
    let path = "."+reqURL.pathname;
    return path;
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

function errorHeader(res)
{
    res.statusCode = 404;
    res.setHeader("connection", "close");
}