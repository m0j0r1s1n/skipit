// SkipIt booking system

const rates = {
    "Mini Trailer": 40,
    "Standard Trailer": 60,
    "Maxi Trailer": 85
};


// Select trailer from pricing cards

function chooseTrailer(name) {

    const select = document.getElementById("trailer");

    if(select) {

        select.value = name;

        document
        .getElementById("booking")
        .scrollIntoView({
            behavior:"smooth"
        });

    }

}



// Calculate hire cost

function calculatePrice() {


    const trailer =
    document.getElementById("trailer").value;


    const start =
    new Date(document.getElementById("startDate").value);


    const end =
    new Date(document.getElementById("endDate").value);



    if(!trailer || isNaN(start) || isNaN(end)) {

        document.getElementById("estimate").innerHTML="£0";

        return;

    }



    const difference =
    end - start;


    const days =
    Math.ceil(
        difference /
        (1000 * 60 * 60 * 24)
    );



    if(days <= 0) {

        document.getElementById("estimate").innerHTML=
        "Invalid dates";

        return;

    }



    const total =
    days * rates[trailer];



    document.getElementById("estimate").innerHTML =
    "£" + total;


}



// Watch booking fields


document.addEventListener(
"DOMContentLoaded",
()=>{


const fields = [

"trailer",
"startDate",
"endDate"

];


fields.forEach(id=>{


const element =
document.getElementById(id);


if(element){

element.addEventListener(
"change",
calculatePrice
);

}


});



const form =
document.getElementById("bookingForm");



if(form){


form.addEventListener(
"submit",
function(event){


event.preventDefault();



const name =
document.getElementById("name").value;


const phone =
document.getElementById("phone").value;


const email =
document.getElementById("email").value;


const trailer =
document.getElementById("trailer").value;


const start =
document.getElementById("startDate").value;


const end =
document.getElementById("endDate").value;


const waste =
document.getElementById("waste").value;


const address =
document.getElementById("address").value;



const subject =
encodeURIComponent(
"SkipIt Booking Request"
);



const body =
encodeURIComponent(

`
New SkipIt booking request

Name:
${name}

Phone:
${phone}

Email:
${email}

Trailer:
${trailer}

Dates:
${start} to ${end}

Waste:
${waste}

Address:
${address}

`

);



window.location.href =
`mailto:hello@skipit.work?subject=${subject}&body=${body}`;



document.getElementById("success")
.style.display="block";


});


}


});
