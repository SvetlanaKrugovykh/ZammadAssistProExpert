window.addEventListener('hashchange', function () {
  console.log('Изменение в фрагменте URL:', window.location.hash);
  const currentPageURL = window.location.href;
  console.log(currentPageURL);

  if (document.getElementById('buttonRequest8001Id')) {
    console.log('removing the button', currentPageURL);
    document.getElementById('buttonRequest8001Id').remove();
  }

  if (currentPageURL.includes('#ticket/zoom/')) {
    console.log('Текущая страница - заявка', currentPageURL);
    const buttonRequest = $('<button>▶︎ Запит замовнику</button>');
    buttonRequest.attr('id', 'buttonRequest8001Id');

    buttonRequest.css({
      'position': 'fixed',
      'bottom': '8px',
      'padding': '10px',
      'right': '377px',
      'background-color': '#cc553a',
      'color': '#FFFFFF',
      'width': '177px',
      'height': '41.3px',
      'cursor': 'pointer',
    });

    buttonRequest.hover(function () {
      $(this).css('background-color', '#ff7f50');
    }, function () {
      $(this).css('background-color', '#cc553a');
    });

    buttonRequest.on('click', function () {
      const confirmation = confirm("Ви впевнені, що хочете виконати цю дію?");

      if (confirmation) {
        const requestData = {
          currentPageURL: currentPageURL,
        };
        const options = {
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
      } else {
        console.log("The action canceled by user!");
      }
    });
    $('body').append(buttonRequest);
  }
});

// start application
(function () {
  new App.Run();
})();
