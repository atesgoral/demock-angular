(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([ 'angular', 'demock' ], factory);
    } else if (typeof exports === 'object') {
        factory(require('angular'), require('demock'));
    } else {
        factory(root.angular, root.demock);
    }
}(this, function (angular, demock) {
    demock.init = function () {
        return [ '$httpProvider', function ($httpProvider) {
            $httpProvider.interceptors.push([ '$q', '$window', function ($q, $window) {
                return {
                    request: function (config) {
                        var request = {
                            method: config.method,
                            url: config.url,
                            params: angular.extend({}, config.data, config.params)
                        };

                        demock.filterRequest(request);

                        config.method = request.method;
                        config.url = request.url;
                        config.data = request.params;

                        return config;
                    },
                    response: function (_response) {
                        var request = {
                                params: _response.config.data
                            },
                            response = {
                                statusCode: _response.status,
                                data: _response.data
                            },
                            dfd = $q.defer();

                        while (demock.filterResponse(request, response)) {}

                        function resolve() {
                            _response.status = response.statusCode;
                            _response.data = response.data;

                            if (response.timeout) {
                                _response.statusCode = 404; // @todo Current Angular behaviour is 404. Might change to 0 in the future.
                                dfd.reject(_response);
                            } else if (response.statusCode >= 400 && response.statusCode < 600) {
                                dfd.reject(_response);
                            } else {
                                dfd.resolve(_response);
                            }
                        }

                        if (response.delay) {
                            var timeout = $window.setTimeout(resolve, response.delay);

                            // @todo needs testing
                            if (_response.config.timeout && _response.config.timeout.then) {
                                _response.config.timeout.then(function () {
                                    $window.clearTimeout(timeout);
                                });
                            }

                            return dfd.promise;
                        } else {
                            resolve();
                            return dfd.promise;
                        }
                    }
                };
            }]);
        }];
    };
}));
