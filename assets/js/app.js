document.addEventListener("DOMContentLoaded", function () {

    console.log("SkipIt JS loaded");


    // Trailer buttons

    window.chooseTrailer = function(trailer) {

        const select = document.getElementById("trailer");

        if(select){
            select.value = trailer;
        }

        const booking = document.getElementById("booking");

        if(booking){
            booking.scrollIntoView({
                behavior:"smooth"
            });
        }

    };


    // Price calculator

    const start = document.getElementById("startDate");
    const end = document.getElementById("endDate");
    const estimate = document.getElementById("estimate");


    function calculatePrice(){

        if(!start || !end || !estimate){
            return;
        }


        if(!start.value || !end.value){

            estimate.textContent="£0";
            return;

        }


        const startDate = new Date(start.value);
        const endDate = new Date(end.value);


        const difference =
        Math.ceil(
            (endDate-startDate)
            /(1000*60*60*24)
        );


        if(difference <=0){

            estimate.textContent="£0";
            return;

        }


        const prices = {

            "Mini Trailer":40,
            "Standard Trailer":60,
            "Maxi Trailer":90

        };


        const trailer =
        document.getElementById("trailer");


        let price = 0;


        if(trailer && prices[trailer.value]){

            price = prices[trailer.value];

        }


        estimate.textContent =
        "£" + (difference * price);


    }



    if(start){
        start.addEventListener(
            "change",
            calculatePrice
        );
    }


    if(end){
        end.addEventListener(
            "change",
            calculatePrice
        );
    }


    const trailer =
    document.getElementById("trailer");


    if(trailer){

        trailer.addEventListener(
            "change",
            calculatePrice
        );

    }



    // Booking form

    const form =
    document.getElementById("bookingForm");


    const success =
    document.getElementById("success");


    if(form){

        form.addEventListener(
            "submit",
            function(e){

                e.preventDefault();


                form.style.display="none";


                if(success){

                    success.style.display="block";

                }


            }
        );

    }


});