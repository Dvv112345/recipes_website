function compPassword()
{
    // alert("Compare");
    let password1 = document.getElementById("regPassword");
    let password2 = document.getElementById("regPassword2");
    if (password1.value == password2.value)
    {
        return true;
    }
    else
    {
        password2.classList.add("is-invalid");
        password2.classList.remove("is-valid");
        return false;
    }
}

function togglePasswordReq(elem, condition)
{
    if (condition)
    {
        elem.classList.add("satisfied");
    }
    else
    {
        elem.classList.remove("satisfied");
    }
}

// Check form when an input is focused
let registerForm = document.getElementById("registerForm");
let inputs = document.getElementsByClassName("registerInput");
for (let elem of inputs)
{
    elem.addEventListener("focus", createCheckFunc(registerForm));
}

let password = document.getElementById("regPassword");
let password2 = document.getElementById("regPassword2");
password.addEventListener("keyup", ()=>{
    // Update password2's pattern
    let password2Pattern = password.value.replaceAll(/\W/g, (val)=>"\\"+val);
    password2.setAttribute("pattern", password2Pattern);
    // Check if each constraint is satified and change the requirements' color
    let val = password.value;
    togglePasswordReq(document.getElementById("letter"), val.match(/[a-zA-Z]/))
    togglePasswordReq(document.getElementById("length"), val.length >= 8)
    togglePasswordReq(document.getElementById("number"), val.match(/\d/))
}
);