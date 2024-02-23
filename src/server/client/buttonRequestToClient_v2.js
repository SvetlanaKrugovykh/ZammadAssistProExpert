$(window).on('load', function () {
  var currentPageURL = window.location.href;
  console.log(currentPageURL);

  if (currentPageURL.includes('#ticket')) {
    console.log('Текущая страница - заявка', currentPageURL);
    var iconGroup = $('.tabsSidebar-tabs')
    var buttonRequest = $('<button>▶︎</button>');
    buttonRequest.text('▶︎ Запит замовнику');
    buttonRequest.insertAfter(iconGroup);

    buttonRequest.css({
      'margin-top': '25px',
      'background-color': '#cc553a',
      'color': '#FFFFFF',
      'width': '197px',
      'height': '80px',
      'position': 'relative',
      'display': 'flex',
      'justify-content': 'center',
      'align-items': 'center',
      'cursor': 'pointer',
    });

    buttonRequest.hover(function () {
      $(this).css('background-color', '#ff7f50');
    }, function () {
      $(this).css('background-color', '#cc553a');
    });

    buttonRequest.on('click', function () {
      var confirmation = confirm("Ви впевнені, що хочете виконати цю дію?");

      if (confirmation) {
        var requestData = {
          currentPageURL: currentPageURL,
        };
        var options = {
          method: 'POST',
          mode: "cors",
          cache: "no-cache",
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*'
          },
          body: JSON.stringify(requestData)
        };

        fetch('https://NAME:8001/inter-connect/tickets/data-request/', options)
          .then(response => response.json())
          .then(data => {
            console.log(data);
          })
          .catch(error => console.error('Ошибка:', error));
      } else {
        console.log("The action canceled by user!");
      }
    });
  }
});
