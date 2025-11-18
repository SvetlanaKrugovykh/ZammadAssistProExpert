(function () {
  var buttonRequestClass = 'buttonRequest';

  function createModal() {
    var modalHTML = `
      <div id="confirmationModal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#f5f5f5; padding:20px; border:1px solid #c8543e; box-shadow:0 4px 8px rgba(0,0,0,0.2); border-radius:8px; z-index:1001;">
        <p style="margin:0; font-size:16px; color:#333;">Ви впевнені, що хочете виконати цю дію?</p>
        <div style="margin-top:20px; text-align:center;">
          <button id="confirmYes" style="background:#c8543e; color:#fff; border:none; border-radius:4px; padding:10px 20px; font-size:16px; cursor:pointer; margin-right:10px;">Так</button>
          <button id="confirmNo" style="background:#e0e0e0; color:#333; border:none; border-radius:4px; padding:10px 20px; font-size:16px; cursor:pointer;">Ні</button>
        </div>
      </div>
      <div id="overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000;"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  function showModal(onConfirm, onCancel) {
    document.getElementById('confirmationModal').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';

    document.getElementById('confirmYes').onclick = function () {
      document.getElementById('confirmationModal').style.display = 'none';
      document.getElementById('overlay').style.display = 'none';
      if (onConfirm) onConfirm();
    };

    document.getElementById('confirmNo').onclick = function () {
      document.getElementById('confirmationModal').style.display = 'none';
      document.getElementById('overlay').style.display = 'none';
      if (onCancel) onCancel();
    };
  }

  function addButton() {
    var currentPageURL = window.location.href;
    console.log('Текущая страница:', currentPageURL);

    if (currentPageURL.includes('#ticket')) {
      console.log('Текущая страница - заявка', currentPageURL);

      if (!document.getElementById('confirmationModal')) {
        createModal();
      }

      setTimeout(function () {
        var iconGroup = $('.tabsSidebar-tabs');
        console.log('iconGroup найден:', iconGroup.length > 0);

        if (iconGroup.length > 0) {
          if (!$('.' + buttonRequestClass).length) {
            var buttonRequest = $('<button class="' + buttonRequestClass + '">▶︎ Запит замовнику</button>');

            buttonRequest.css({
              'background-color': '#c8543e',
              'color': '#cccccc',
              'width': '150px',
              'height': '40px',
              'position': 'absolute',
              'bottom': '10px',
              'left': '50%',
              'transform': 'translateX(-50%)',
              'display': 'block',
              'border': 'none',
              'border-radius': '5px',
              'cursor': 'pointer',
              'z-index': '1000'
            });

            buttonRequest.insertAfter(iconGroup);

            buttonRequest.on('click', function () {
              console.log('Button clicked');
              showModal(function () {
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

                console.log('Reuest:', {
                  url: 'https://service-desk.lotok.ua:8001/inter-connect/tickets/data-request/',
                  body: requestData,
                  options
                });

                fetch('https://service-desk.lotok.ua:8001/inter-connect/tickets/data-request/', options)
                  .then(response => response.json())
                  .then(data => {
                    console.log(data);
                  })
                  .catch(error => console.error('Ошибка:', error));
              }, function () {
                console.log("The action canceled by user!");
              });
            });
          }
        } else {
          $('.' + buttonRequestClass).remove();
        }
      }, 500);
    } else {
      $('.' + buttonRequestClass).remove();
    }
  }

  window.addEventListener('hashchange', function () {
    addButton();
  });

  window.addEventListener('load', function () {
    addButton();
  });
})();
