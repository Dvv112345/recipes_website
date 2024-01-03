const crypto = require("crypto")

class Session {
    // A session variable for maintaining a user's session.
    constructor (username)
    {
        this.username = username;
        this.recentlyUsed = true;
    }
}

class SessionList {
    constructor ()
    {
        this.list = {}
        this.secret = Math.round(Math.random() * 1000000).toString();
    }

    addSession(username)
    {
        let sessionID = Math.round(Math.random() * 1000000).toString();
        while (this.list.hasOwnProperty(sessionID))
        {
            sessionID = Math.round(Math.random() * 1000000).toString();
        }
        let newSession = new Session(username) 
        this.list[sessionID] = newSession;
        return this.createCookie(sessionID);
    }

    validateSession(cookieString, res)
    {
        // Validate whether the cookie contain a valid sessionID
        if (!cookieString)
        {
            return {"login":false};
        }
        let cookies = cookieString.split(";")
        for (let cookie of cookies)
        {
            let pair = cookie.split("=")
            {
                if (pair[0] == "sessionID")
                {
                    let sessionIDHash = pair[1].split("--")
                    if (this.list.hasOwnProperty(sessionIDHash[0]) && this.getHmac(sessionIDHash[0])==sessionIDHash[1])
                    {
                        this.list[sessionIDHash[0]].recentlyUsed = true;
                        return {"login":true, "username":this.list[sessionIDHash[0]].username, "sessionID": sessionIDHash[0]};
                    }
                    else
                    {
                        res.setHeader("set-cookie", this.removeCookie(cookie));
                        return {"login":false};
                    }
                }
            }
        }
        return {"login":false};
    }

    getHmac(sessionID)
    {
        let hmac = crypto.createHmac("sha256", this.secret);
        hmac.update(sessionID);
        return hmac.digest("hex");
    }

    createCookie (sessionID)
    {
        return `sessionID=${sessionID+"--"+this.getHmac(sessionID)}; HttpOnly`;
    }

    removeCookie(cookie)
    {
        return cookie+"; Max-Age=0";
    }

    removeSession(sessionID)
    {
        // Remove the given session and return the message that can be used to clear the cookie in browser.
        if (sessionID)
        {
            let message = this.removeCookie(this.createCookie(sessionID))
            delete this.list[sessionID];
            return message;
        }
        return false;
    }
}

function checkInactive(sessionList)
{
    // Checks if any session becomes inactive and should be removed. 
    for (let sessionID of Object.keys(sessionList.list))
    {
        if (!sessionList.list[sessionID].recentlyUsed)
        {
            sessionList.removeSession(sessionID);
        }
        else
        {
            sessionList.list[sessionID].recentlyUsed = false;
        }
    }
    console.log(sessionList);
}

module.exports.Session = Session;
module.exports.SessionList = SessionList;
module.exports.checkInactive = checkInactive;