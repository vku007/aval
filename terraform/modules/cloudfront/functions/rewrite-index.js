function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var last = uri.split('/').pop();

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (last.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }

  return request;
}
