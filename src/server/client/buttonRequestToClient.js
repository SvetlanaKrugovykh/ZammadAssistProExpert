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
      'background-color': 'orange',
      'сolor': 'grey',
      'width': '97px',
      'height': '60px',
      'position': 'relative',
      'display': 'flex'
    });

    buttonRequest.on('click', function () {
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

      fetch('https://servicedesk.lotok.ua:8001/inter-connect/tickets/data-request/', options)
        .then(response => response.json())
        .then(data => {
          console.log(data);
        })
        .catch(error => console.error('Ошибка:', error));
    });
  }
});
