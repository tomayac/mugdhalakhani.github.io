self.addEventListener('install', function(event) {
  event.waitUntil(skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

function extractResponse(fetch) {
  return new Promise((resolve, reject) => {
    var response = fetch.response, headers = {};

    for (var [name, value] of response.headers) headers[name] = value;

    var result = {
      type: response.type,
      url: response.url,
      redirected: response.redirected,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: headers
    };

    // Try clone the |response| and read it as a stream. Not required, but
    // Paul tells me this is required for him to enjoy cat jokes.
    if (response.body) {
      var clone = response.clone();
      var reader = clone.body.getReader();
      var byteCount = 0;

      var onStreamData = streamResult => {
        if (streamResult.done) {
          console.log(
              'Read ' + byteCount + ' bytes from the cloned response for ' +
              response.url);
          return;
        }

        byteCount += streamResult.value.length;
        return reader.read().then(onStreamData);
      };

      reader.read().then(onStreamData);
    }

    response.arrayBuffer().then(
        buffer => {
          console.log(
              'Read ' + buffer.byteLength + ' bytes for ' + response.url);

          var uint8Buffer = new Uint8Array(buffer), uint8Data = '';

          for (var i = 0; i < buffer.byteLength; ++i)
            uint8Data += String.fromCharCode(uint8Buffer[i]);

          result.data = btoa(uint8Data);
          resolve(result);
        },
        error => {
          console.log('Error for ' + response.url, error);
          resolve(result);
        });
  });
}

function handleBackgroundFetchEvent(eventName, event) {
  console.log('Received the ' + eventName + ' event');

  var promii = [];

  event.waitUntil(new Promise(eventResolve => {
    self.registration.backgroundFetch.fetch('id7', ['domokun.jpg', '../resources/files/Pride_and_Prejudice.pdf'], {});
    event.fetches.values().then(fetches => {
      fetches.forEach(fetch => promii.push(extractResponse(fetch)));
      promii.push(event.updateUI({
        title: 'Updated Title!',
        icons: [{'src': '/resources/icons/icon2.png', sizes: '128x128', type: 'image/png', purpose: 'any'}],
      }));

      var id = event.id || event.tag;
      // Distribute the |results| to all controlled window |clients|.
      Promise.all(promii).then((results) => {
        results.pop();  // remove updateUI promise.
        clients.matchAll({type: 'window'}).then(clients => {
          clients.forEach(
              client => client.postMessage({eventName, id, results}));
          eventResolve();
        });
      });
    });
  }));
}

self.addEventListener(
    'backgroundfetched',
    handleBackgroundFetchEvent.bind(null, 'backgroundfetched'));
self.addEventListener(
    'backgroundfetchfail',
    handleBackgroundFetchEvent.bind(null, 'backgroundfetchfail'));

self.addEventListener('backgroundfetchabort', event => {
  var eventName = 'backgroundfetchabort';
  var id = event.id || event.tag;

  event.waitUntil(clients.matchAll({type: 'window'})
                      .then(
                          clients => clients.forEach(
                              client => client.postMessage({eventName, id}))));
});

self.addEventListener('fetch', () => {
  return;
});
