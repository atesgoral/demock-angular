(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([ 'angular', 'demock' ], factory);
    } else if (typeof exports === 'object') {
        factory(require('angular'), require('demock'));
    } else {
        factory(root.angular, root.demock);
    }
}(this, function (angular, Demock) {
    function normalizeParams(config) {
        if (config.params) {
            return config.params;
        } else if (config.data) {
            if (typeof config.data === 'object') {
                return config.data;
            } else if (typeof config.data === 'string') {
                try {
                    return JSON.parse(config.data);
                } catch (e) {}
            }
        }
    }

    angular.module('demock', [])
        .provider('$demock', function () {
            var demock = new Demock(),
                requestFilters = [],
                responseFilters = [],
                loggerFactory;

            this.requestFilters = Demock.requestFilters;
            this.responseFilters = Demock.responseFilters;

            this.appendRequestFilter = function (factory, config) {
                requestFilters.push({
                    factory: factory,
                    config: config
                });
                return this;
            };

            this.appendResponseFilter = function (factory, config) {
                responseFilters.push({
                    factory: factory,
                    config: config
                });
                return this;
            };

            this.setLogger = function (factory) {
                loggerFactory = factory;
            };

            this.$get = [ '$injector', function ($injector) {
                requestFilters.forEach(function (filter) {
                    demock.appendRequestFilter($injector.invoke(filter.factory, null, { config: filter.config }));
                });

                responseFilters.forEach(function (filter) {
                    demock.appendResponseFilter($injector.invoke(filter.factory, null, { config: filter.config }));
                });

                if (loggerFactory) {
                    demock.setLogger($injector.invoke(loggerFactory));
                }

                return demock;
            }];
        })
        .config([ '$httpProvider', function ($httpProvider) {
            $httpProvider.interceptors.push([ '$q', '$window', '$demock', function ($q, $window, $demock) {
                return {
                    request: function (config) {
                        var request = {
                            method: config.method,
                            url: config.url,
                            params: normalizeParams(config),
                            headers: {}
                        };

                        $demock.filterRequest(request);

                        config.method = request.method;
                        config.url = request.url;
                        config.headers = request.headers;
                        config.__demockRequest = request;

                        return config;
                    },
                    response: function (_response) {
                        var request = _response.config.__demockRequest,
                            response = {
                                statusCode: _response.status,
                                data: _response.data
                            },
                            dfd = $q.defer();

                        $demock.filterResponse(request, response);

                        function resolve() {
                            _response.status = response.statusCode;
                            _response.data = response.data;

                            if (response.timeout) {
                                _response.status = 0;
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
        }]);
}));
