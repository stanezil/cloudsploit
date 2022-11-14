var expect = require('chai').expect;
const elbv2DeprecatedSslPolicies = require('./elbv2DeprecatedSslPolicies.js');

const describeLoadBalancers = [
    {
        "LoadBalancerArn": "arn:aws:elasticloadbalancing:us-east-1:111122223333:loadbalancer/net/ak-40-network/ea75308eb0df27e4",
        "DNSName": "ak-40-network-ea75308eb0df27e4.elb.us-east-1.amazonaws.com",
        "CanonicalHostedZoneId": "Z26RNL4JYFTOTI",
        "CreatedTime": "2020-11-03T22:49:47.656Z",
        "LoadBalancerName": "ak-40-network",
        "Scheme": "internet-facing",
        "VpcId": "vpc-99de2fe4",
        "State": {
            "Code": "active"
        },
        "Type": "application",
        "AvailabilityZones": [
            {
                "ZoneName": "us-east-1a",
                "SubnetId": "subnet-06aa0f60",
                "LoadBalancerAddresses": []
            }
        ],
        "IpAddressType": "ipv4"
    }
];

const describeListeners = [
    {
        "Listeners" : [
            {
                "ListenerArn": "arn:aws:elasticloadbalancing:us-east-1:111122223333:listener/net/ak-40-network/ea75308eb0df27e4/467117f2e8cbb4cb",
                "LoadBalancerArn": "arn:aws:elasticloadbalancing:us-east-1:111122223333:loadbalancer/net/ak-40-network/ea75308eb0df27e4",
                "Port": 443,
                "Protocol": "HTTPS",
                "Certificates": [{"CertArn":"arn:aws:acm:us-east-1:111122223333:test-elb"}],
                "SslPolicy": "ELBSecurityPolicy-2015-05",
            }
        ],
    },
    {
        "Listeners" : [
            {
                "ListenerArn": "arn:aws:elasticloadbalancing:us-east-1:111122223333:listener/net/ak-40-network/ea75308eb0df27e4/467117f2e8cbb4cb",
                "LoadBalancerArn": "arn:aws:elasticloadbalancing:us-east-1:111122223333:loadbalancer/net/ak-40-network/ea75308eb0df27e4",
                "Port": 80,
                "Protocol": "HTTP",
                "Certificates": []
            }
        ],
    },
    {
        "Listeners":[]
    }, 
    {
        "Listeners" : [
            {
                "ListenerArn": "arn:aws:elasticloadbalancing:us-east-1:111122223333:listener/net/ak-40-network/ea75308eb0df27e4/467117f2e8cbb4cb",
                "LoadBalancerArn": "arn:aws:elasticloadbalancing:us-east-1:111122223333:loadbalancer/net/ak-40-network/ea75308eb0df27e4",
                "Protocol": "TLS",
                "Certificates": [{"CertArn":"arn:aws:acm:us-east-1:111122223333:test-elb"}],
                "SslPolicy": "ELBSecurityPolicy-FS-1-2-Res-2020-10",
            }
        ],
    }, 

];

const createCache = (elbv2, listeners) => {
    var lbDnsName = (elbv2 && elbv2.length) ? elbv2[0].DNSName : null;

    return {
        elbv2:{
            describeLoadBalancers: {
                'us-east-1': {
                    data: elbv2
                },
            },
            describeListeners: {
                'us-east-1': {
                    [lbDnsName]: {
                        data: listeners
                    },
                },
            },
        },
    };
};

const createErrorCache = () => {
    return {
        elbv2: {
            describeLoadBalancers: {
                'us-east-1': {
                    err: {
                        message: 'error describing Application/Application Load balancers'
                    },
                },
            },
            describeListeners: {
                'us-east-1': {
                    err: {
                        message: 'error describing load balancer listeners'
                    },
                },
            },
        }
    };
};

const createNullCache = () => {
    return {
        elbv2: {
            describeLoadBalancers: {
                'us-east-1': null,
            },
            describeListeners: {
                'us-east-1': null,
            },
        },
    };
};

describe('elbv2DeprecatedSslPolicies', function () {
    describe('run', function () {

        it('should PASS if No Application Load Balancers found', function (done) {
            const cache = createCache([]);
            elbv2DeprecatedSslPolicies.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('No load balancers found');
                expect(results[0].region).to.equal('us-east-1');
                done();
            });
        });

        it('should UNKNOWN if unable to describe Application Load Balancers', function (done) {
            const cache = createErrorCache();
            elbv2DeprecatedSslPolicies.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].message).to.include('Unable to query for load balancers');
                expect(results[0].status).to.equal(3);
                done();
            });
        });

        it('should UNKNOWN if unable to describe Listeners', function (done) {
            const cache = createCache([describeLoadBalancers[0]]);
            elbv2DeprecatedSslPolicies.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].message).to.include('Unable to query for Listeners');
                expect(results[0].status).to.equal(3);
                done();
            });
        });

        it('should PASS if no Listeners found', function (done) {
            const cache = createCache([describeLoadBalancers[0]],describeListeners[2]);
            elbv2DeprecatedSslPolicies.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].message).to.include('No Listeners found');
                expect(results[0].status).to.equal(0);
                done();
            });
        });

        it('should PASS if no SSL policies found', function (done) {
            const cache = createCache([describeLoadBalancers[0]],describeListeners[1]);
            elbv2DeprecatedSslPolicies.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].message).to.include('No SSL policies found');
                expect(results[0].status).to.equal(0);
                done();
            });
        });

        it('should PASS if listeners on Elbv2 are using deprecated policies', function (done) {
            const cache = createCache([describeLoadBalancers[0]],describeListeners[0]);
            elbv2DeprecatedSslPolicies.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].message).to.include('are using following deprecated policies');
                expect(results[0].status).to.equal(2);
                done();
            });
        });

        it('should PASS if all listeners on Elbv2 are using current policies', function (done) {
            const cache = createCache([describeLoadBalancers[0]],describeListeners[3]);
            elbv2DeprecatedSslPolicies.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].message).to.include('are using current SSL policies');
                expect(results[0].status).to.equal(0);
                done();
            });
        });

    });
});