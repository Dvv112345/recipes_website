function createCheckFunc(form)
{
    // Create a function that checks if a form's inputs satasify its requirements
    return event=>{
        if (form.checkValidity() === false) {
            event.preventDefault();
            event.stopPropagation();
        }
        form.classList.add('was-validated');
    };
}

// Disable submission if there is invalid field
window.addEventListener(
'load', 
function() {
    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    let forms = document.getElementsByClassName('needs-validation');
    // Loop over them and prevent submission if requirement is not met.
    for (let form of forms)
    {
        form.addEventListener('submit', 
            createCheckFunc(form)
        )
    }
}
);