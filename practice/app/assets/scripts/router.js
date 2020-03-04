

;(function(exports) {

  exports.map = {
    '/groups/:id': {
      tag: 'page-groups-single',
    },
    '/users/:id': {
      tag: 'page-users-single',
    },
    '/mypage': {
      tag: 'page-users-single',
    },
    '/@:screen_name': {
      tag: 'page-users-single',
    },
    '/:page': {
      tag: function(req, res) {
        return 'page-' + req.params.page;
      },
    },
    '/': {
      tag: 'page-index',
    }
  };

})(typeof exports === 'undefined' ? this.router = {} : exports);