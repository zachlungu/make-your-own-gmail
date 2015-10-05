var app = angular.module('scriptermail', [
  'ui.router',
  'angular-google-gapi',
  'angularMoment',
  'angular-growl',
  'ngAnimate',
  'forceng'
]);

app.controller('MainCtrl', ['$scope', 'GAuth', '$state', 'growl',
  function($scope, GAuth, $state, growl) {
  
  $scope.doSignup = function() {
    GAuth.login().then(function(){
      $state.go('label', {id: "INBOX"});
    }, function() {
      growl.error('login fail');
    });
  };

}]);

app.controller('InboxCtrl', ['GApi', '$scope', '$rootScope', 'growl', '$stateParams', 'isLoggedIn',
  function(GApi, $scope, $rootScope, growl, $stateParams, isLoggedIn) {

  console.log('InboxCtrl');

  var query = 'in:' + $stateParams.id;
  GApi.executeAuth('gmail', 'users.threads.list', {
    'userId': $rootScope.gapi.user.email,
    'q': query
  }).then(function(data) {
    $scope.threads = data.threads;
  }, function(error) {
    growl.error(error);
  });

}]);

app.controller('ThreadCtrl', ['GApi', '$scope', '$rootScope', '$stateParams', 'growl',
  function(GApi, $scope, $rootScope, $stateParams, growl) {

  GApi.executeAuth('gmail', 'users.threads.get', {
    'userId': $rootScope.gapi.user.email,
    'id': $stateParams.threadId
  }).then(function(data) {
    $scope.messages = data.messages;
    //decode payload: http://stackoverflow.com/a/28622096/468653
    //atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  }, function(error) {
    growl.error(error);
  });
}]);

app.controller('LeadsCtrl', ['$scope', 'force', 'growl',
  function($scope, force, growl) {
  $scope.loginSFDC = function() {
    force.login()
    .then(function () {
      growl.info('Succesfully authed');
      force.query('select id, name, email from contact limit 50')
      .then(function (contacts) {
        $scope.contacts = contacts.records;
      });
    });
  };

}]);


app.directive('gmailLabel', ['GApi', '$rootScope',
  function(GApi, $rootScope) {
  return {
    restrict: 'A',
    templateUrl: 'views/labels.html',
    scope: {
      name: '@'
    },
    link: function(scope, element, attrs) {
      attrs.$observe('name', function(value) {
        GApi.executeAuth('gmail', 'users.labels.get', {
          'userId': $rootScope.gapi.user.email,
          'id': attrs.name,
          'fields': 'id,name,threadsTotal,threadsUnread,type'
        }).then(function(data) {
          scope.activeLabel = data;
        });
      });
    }
  };
}]);


app.filter('num', function() {
  return function(input) {
    return parseInt(input, 10);
  };
});

app.constant('SFDCAppId', __env.SFDC_APP_ID);
app.constant('SFDCCallbackUrl', __env.SFDC_CALLBACK_URL);
app.constant('GoogleClientId', __env.GOOGLE_CLIENT_ID);
app.constant('GoogleScopes', [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/userinfo.email'
]);

app.config(['growlProvider', function(growlProvider) {
  growlProvider.globalTimeToLive(2000);
}]);

app.config(['$stateProvider', '$urlRouterProvider', '$locationProvider',
  function($stateProvider, $urlRouterProvider, $locationProvider) {

  $locationProvider.html5Mode(true);
  $urlRouterProvider.otherwise("/");

  $stateProvider.state('home', {
    url: '/',
    controller: 'MainCtrl',
    templateUrl: 'views/home.html',
    resolve: {
      isLoggedIn: ['$state', 'GAuth', function($state, GAuth) {
        return GAuth.checkAuth().then(function () {
          $state.go('label', {id: "INBOX"});
        }, function() {
          return;
        });
      }]
    }
  });

  $stateProvider.state('secureRoot', {
    templateUrl: 'views/base.html',
    controller: ['isLoggedIn', function(isLoggedIn) {
      console.log('isLoggedIn controller');
    }],
    resolve: {
      isLoggedIn: ['$state', 'GAuth', function($state, GAuth) {
        return GAuth.checkAuth()
        .then(function () {
          return;
        }, function() {
          $state.go('home');
        });
      }]
    }
  });
  $stateProvider.state('label', {
    parent: 'secureRoot',
    url: '/label/:id',
    controller: 'InboxCtrl',
    templateUrl: 'views/inbox.html'
  });
  $stateProvider.state('thread', {
    parent: 'secureRoot',
    url: '/label/:id/thread/:threadId',
    controller: 'ThreadCtrl',
    templateUrl: 'views/thread.html'
  });
  $stateProvider.state('leads', {
    parent: 'secureRoot',
    url: '/leads',
    controller: 'LeadsCtrl',
    templateUrl: 'views/leads.html'
  });
}]);

app.run(['GApi', 'GAuth', 'GoogleClientId', 'GoogleScopes',
        function(GApi, GAuth, GoogleClientId, GoogleScopes) {
          GApi.load('gmail', 'v1');
          GAuth.setClient(GoogleClientId);
          GAuth.setScope(GoogleScopes.join(' '));
        }
      ]);

app.run([
  'force',
  'SFDCAppId',
  'SFDCCallbackUrl',
  function(force, SFDCAppId, SFDCCallbackUrl) {

  force.init({
    appId: SFDCAppId,
    apiVersion: 'v33.0',
    loginURL: 'https://login.salesforce.com',
    oauthCallbackURL: SFDCCallbackUrl,
    proxyURL: 'http://localhost:8200'
  });

}]);
