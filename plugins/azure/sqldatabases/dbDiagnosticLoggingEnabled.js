var async = require('async');
var helpers = require('../../../helpers/azure');

module.exports = {
    title: 'Database Diagnostic Logging Enabled',
    category: 'SQL Databases',
    domain: 'Databases',
    description: 'Ensures diagnostic logging is enabled for SQL databases.',
    more_info: 'Enabling diagnostic logging provides valuable insights into SQL database that helps to monitor resources for their availability, performance, and operation.',
    recommended_action: 'Enable diagnostic logging for SQL databases with the minimum required data recording settings: SQLInsights, ErrorsTimeouts, BlocksDeadlocks, BasicInstanceAndApp, AdvancedWorkloadManagement.',
    link: 'https://learn.microsoft.com/en-us/azure/azure-sql/database/monitoring-sql-database-azure-monitor?view=azuresql',
    apis: ['servers:listSql', 'databases:listByServer', 'diagnosticSettings:listByDatabase'],
    settings: {
        database_diagnostic_settings: {
            name: 'Database Diagnostic Logs/Metrics settings',
            description: 'Desired diagnostic logging provides valuable insights into SQL database that helps to monitor resources for their availability, performance, and operation.',
            regex: '/^(Basic|InstanceAndAppAdvanced|WorkloadManagement|SQLInsights|Errors|Timeouts|Blocks|Deadlocks|allLogs|audit)(,s*(Basic|InstanceAndAppAdvanced|WorkloadManagement|SQLInsights|Errors|Timeouts|Blocks|Deadlocks|allLogs|audit))*$/i',  
            default: 'basic,InstanceAndAppAdvanced,WorkloadManagement,audit'
        },
    },
    
    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var locations = helpers.locations(settings.govcloud);
        var recommendedDiagnosticSettings = settings.database_diagnostic_settings || this.settings.database_diagnostic_settings.default;

        async.each(locations.servers, function(location, rcb) {
            var servers = helpers.addSource(cache, source, ['servers', 'listSql', location]);

            if (!servers) return rcb();

            if (servers.err || !servers.data) {
                helpers.addResult(results, 3, 'Unable to query for SQL servers: ' + helpers.addError(servers), location);
                return rcb();
            }

            if (!servers.data.length) {
                helpers.addResult(results, 0, 'No SQL servers found', location);
                return rcb();
            }

            servers.data.forEach(function(server) {
                var databases = helpers.addSource(cache, source,
                    ['databases', 'listByServer', location, server.id]);

                if (!databases || databases.err || !databases.data) {
                    helpers.addResult(results, 3,
                        'Unable to query for SQL server databases: ' + helpers.addError(databases), location, server.id);
                } else {
                    if (!databases.data.length) {
                        helpers.addResult(results, 0,
                            'No databases found for SQL server', location, server.id);
                    } else {
                        databases.data.forEach(database=> {
                            
                            var diagnosticSettings = helpers.addSource(cache, source, ['diagnosticSettings', 'listByDatabase', location, database.id]);
                        
                            if (!diagnosticSettings || diagnosticSettings.err || !diagnosticSettings.data) {
                                helpers.addResult(results, 3, 'Unable to query SQL database diagnostic settings: ' + helpers.addError(diagnosticSettings), location, database.id);
                            } else {
                                if (!diagnosticSettings.data.length) {
                                    helpers.addResult(results, 2, 'Diagnostic settings are not configured for SQL database', location, database.id);
                                } else { 
                                    var enabledDiagnosticLogs = [];
                                    var enabledDiagnosticMetrics = [];
                                    var enabledSettings = [];
                                    diagnosticSettings.data.forEach(settings => { 
                                        settings.logs.forEach((e) => e.enabled && !enabledDiagnosticLogs.includes(e.category || e.categoryGroup) && enabledDiagnosticLogs.push(e.category || e.categoryGroup));
                                        settings.metrics.forEach((e) => e.enabled && !enabledDiagnosticMetrics.includes(e.category) && enabledDiagnosticMetrics.push(e.category));

                                    });
                                    enabledSettings = [...enabledDiagnosticLogs, ...enabledDiagnosticMetrics].toString().toLocaleLowerCase().split(',');
                                    recommendedDiagnosticSettings = recommendedDiagnosticSettings.toLowerCase().split(',');
                                    var skippedRecommendedSettings = recommendedDiagnosticSettings.filter((e) => !enabledSettings.includes(e));

                                    if (skippedRecommendedSettings.length) {
                                        helpers.addResult(results, 2, `Database diagnostic settings are not configured with minimum requirements. Missing: ${skippedRecommendedSettings.join(', ')} `, location, database.id);
                                    } else {
                                        helpers.addResult(results, 0,
                                            'Database diagnostic settings are configured with minimum requirements', location, database.id);
                                    }

                                }
                            }
                        });
                    }
                }
            });

            rcb();
        }, function() {
            callback(null, results, source);
        });
    }
};
