window.addEventListener("load", function () {
    getData();
});

function getData()
{
    axios.post("/getRecipe", {}, {"headers":{"content-type": "application/json", "accept": "application/json"}}).then(
        (response)=>{
            if (response.status == 200)
            {
                const parent = document.getElementById("recipes")
                for (let doc of response.data)
                {
                    let col = document.createElement("div");
                    col.className = "col-12 col-md-6 col-lg-4 my-1";
                    parent.append(col);
                    let link = document.createElement("a");
                    link.setAttribute("href", `recipe/${doc["_id"]}`);
                    link.className = "cardLink";
                    col.appendChild(link);
                    let card = document.createElement("div");
                    card.className = "card";
                    link.appendChild(card);
                    let cardBody = document.createElement("div");
                    cardBody.className = "card-body";
                    card.appendChild(cardBody);
                    let title = document.createElement("h3")
                    title.className = "card-title text-center";
                    title.innerHTML = doc["name"];
                    cardBody.appendChild(title);
                    let cardText = document.createElement("p");
                    cardText.className = "card-text px-3";
                    const totalMinutes = doc["duration"];
                    const durationHours = Math.floor(totalMinutes / 60);
                    const durationMinutes = totalMinutes % 60;
                    let durationHTML = "";
                    if (durationHours)
                    {
                        durationHTML = `${durationHours} hour `;
                    }
                    durationHTML = durationHTML.concat(`${durationMinutes} minutes`);
                    cardText.innerHTML = `Cuisine: ${doc["cuisine"]}
                    <br>
                    Difficulty: ${doc["difficulty"]}
                    <br>
                    Duration: 
                    ${durationHTML}
                    <br>
                    Likes: ${doc["favCount"]}
                    <br>
                    Uploaded by: ${doc["owner"]}`
                    cardBody.appendChild(cardText);
                }
            }
        }).catch(getData);
}

dropDowns = document.getElementsByClassName("dropdown-toggle")
for (let toggle of dropDowns)
{
    toggle.onclick = ()=>{closeOther(toggle.id)};
}

function closeOther(id)
{
    for (let toggle of dropDowns)
    {
        if (toggle.id != id)
        {
            toggle.setAttribute("aria-expanded", "false");
            for (let child of toggle.parentElement.children)
            {
                if (child.tagName == "UL")
                {
                    child.classList.remove("show");
                }
            }
        }
    }
}

checkboxes = document.getElementsByClassName("form-check-input");
for (let checkbox of checkboxes)
{
    if (checkbox.name == "duration" || checkbox.name == "difficulty" || checkbox.name == "cuisine")
    {
        console.log(checkbox.value);
    } 
}