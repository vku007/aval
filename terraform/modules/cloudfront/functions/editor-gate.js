function handler(event) {
  var request = event.request;
  var cookies = request.cookies || {};
  if (!cookies['CloudFront-Policy'] || !cookies['CloudFront-Signature'] || !cookies['CloudFront-Key-Pair-Id']) {
    return {
      statusCode: 302,
      statusDescription: 'Found',
      headers: {
        location: { value: '/login.html?next=/editor/session.html' },
        'cache-control': { value: 'no-store' }
      }
    };
  }

  var uri = request.uri;
  var last = uri.split('/').pop();
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (last.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }
  return request;
}
