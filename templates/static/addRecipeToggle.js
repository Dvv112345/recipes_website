material = 1;
step = 1;

function addNew(divId)
{
    let counter = 0;
    let text = "";
    if (divId == "material")
    {
        material += 1;
        counter = material;
        text = "Material"
    }
    else if (divId == "step")
    {
        step += 1;
        counter = step;
        text = "Step"
    }
    let target = document.getElementById(divId);
    let row = document.createElement("div");
    row.className = "row g-1 mb-1";
    row.id = `${divId}Row${counter}`;
    let floatingForm = document.createElement("div");
    floatingForm.className = "form-floating col-9";
    let input = document.createElement("input");
    input.type = "text";
    input.className = "form-control";
    input.id = `${divId}${counter}`;
    input.name = divId;
    input.setAttribute("placeholder", divId);
    input.setAttribute("autocomplete", "off");
    input.required = true;
    floatingForm.appendChild(input);
    let label = document.createElement("label");
    label.setAttribute("for", `${divId}${counter}`);
    label.innerHTML = `${text}`;
    floatingForm.appendChild(label);
    row.appendChild(floatingForm);
    let butDiv = document.createElement("div");
    butDiv.className = "col-3";
    let button = document.createElement("button");
    button.setAttribute("type", "button");
    button.className = "btn btn-outline-danger h-100 w-100";
    button.innerHTML = "Delete";
    button.setAttribute("onclick", `deleteInput(${row.id}, '${divId}')`);
    butDiv.appendChild(button);
    row.appendChild(butDiv);
    target.appendChild(row);
}


function deleteInput(rowId, divId)
{
    rowId.remove();
}
