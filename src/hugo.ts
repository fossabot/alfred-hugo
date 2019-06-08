import { Cache } from "@cloudstek/cache";
import { ICacheOptions } from "@cloudstek/cache";
import fs from "fs-extra";
import crypto from "crypto";
import Fuse from "fuse.js";
import Axios, { AxiosRequestConfig } from "axios";
import moment from "moment";
import path from "path";
import Semver from "semver";
import NotificationCenter from "node-notifier/notifiers/notificationcenter";

import { Action } from "./action";
import { FileCache } from "./file-cache";
import { Updater } from "./updater";
import * as utils from "./utils";
import { AlfredMeta, FilterResults, HugoOptions, WorkflowMeta, UpdateSource, Item } from "./types";

export class Hugo {
    public cache: Cache;
    public config: Cache;
    public rerun: number;
    public variables: { [key: string]: any } = {};
    public items: Item[] = [];

    private actions: Action[];
    private fuseDefaults: Fuse.FuseOptions<any>;
    private options: HugoOptions;
    private updater: Updater;
    private notifier: NotificationCenter;

    public constructor(options?: HugoOptions) {
        // Save options
        this.options = {
            checkUpdates: true,
            updateInterval: moment.duration(1, "day"),
            updateItem: true,
            updateNotification: true,
            updateSource: UpdateSource.NPM,
        };

        this.configure(options || {});

        // Set defaults for FuseJS
        this.fuseDefaults = {
            keys: ["title"],
            threshold: 0.4,
        };

        // Configure config store
        this.config = new Cache({
            dir: this.workflowMeta.data,
            name: "config.json",
            ttl: false,
        });

        // Configure cache store
        this.cache = new Cache({
            dir: this.workflowMeta.cache,
        });

        // Initialize updater
        this.updater = new Updater(this.cache, this.options.updateInterval);

        // Notofier
        this.notifier = new NotificationCenter();

        // Actions
        this.actions = [];
    }

    /**
     * Set Hugo options
     *
     * @param options Options to set
     */
    public configure(options: HugoOptions): Hugo {
        // Update options
        options = Object.assign({}, this.options, options);

        // Convert updateInterval to moment.Duration object
        if (options.updateInterval) {
            if (!moment.isDuration(options.updateInterval)) {
                options.updateInterval = moment.duration(options.updateInterval, "seconds");
            }
        }

        if (!options.updateInterval || (options.updateInterval as moment.Duration).asSeconds() < 1) {
            options.checkUpdates = false;
            delete options.updateInterval;
        }

        if (typeof options.updateSource !== "string" || !UpdateSource[options.updateSource.toLowerCase() as any]) {
            throw new Error("Invalid update source.");
        }

        this.options = options;

        return this;
    }

    /**
     * Alfred metadata
     *
     * @return
     */
    public get alfredMeta(): AlfredMeta {
        let version = Semver.valid(Semver.coerce(process.env.alfred_version));

        // Check if version is valid
        if (version === null) {
            if (process.env.alfred_debug === "1") {
                console.error(`Invalid Alfred version: ${process.env.alfred_version}`);
            }

            version = undefined;
        }

        // Gather environment information
        const data: AlfredMeta = {
            debug: process.env.alfred_debug === "1",
            preferences: process.env.alfred_preferences,
            preferencesLocalHash: process.env.alfred_preferences_localhash,
            theme: process.env.alfred_theme,
            themeBackground: process.env.alfred_theme_background,
            themeSelectionBackground: process.env.alfred_theme_selection_background,
            themeSubtext: parseFloat(process.env.alfred_theme_subtext || "0"),
            version,
        };

        // Find and load curent Alfred theme file
        if (process.env.HOME && data.theme) {
            const homedir: string = process.env.HOME;

            const themeFile = path.resolve(homedir, "Library", "Application Support", "Alfred " + Semver.major(version),
                "Alfred.alfredpreferences", "themes", data.theme, "theme.json");

            try {
                fs.statSync(themeFile);
                data.themeFile = themeFile;
            } catch (e) {
                if (process.env.alfred_debug === "1") {
                    console.error(`Could not find theme file "${themeFile}"`);
                }
            }
        }

        return data;
    }

    /**
     * Alfred theme
     */
    public get alfredTheme(): object {
        const themeFile = this.alfredMeta.themeFile;

        if (!themeFile || utils.fileExists(themeFile) === false) {
            return {};
        }

        return fs.readJsonSync(themeFile);
    }

    /**
     * Workflow metadata
     */
    public get workflowMeta(): WorkflowMeta {
        let version = Semver.valid(Semver.coerce(process.env.alfred_workflow_version));

        // Check if version is valid
        if (version === null) {
            if (process.env.alfred_debug === "1") {
                console.error(`Invalid workflow version: ${process.env.alfred_workflow_version}`);
            }

            version = undefined;
        }

        return {
            bundleId: process.env.alfred_workflow_bundleid,
            cache: process.env.alfred_workflow_cache,
            data: process.env.alfred_workflow_data,
            icon: path.join(process.cwd(), "icon.png"),
            name: process.env.alfred_workflow_name,
            uid: process.env.alfred_workflow_uid,
            version,
        };
    }

    /**
     * Reset Hugo.
     */
    public reset() {
        this.rerun = undefined;
        this.variables = {};
        this.items = [];

        return this;
    }

    /**
     * Alfred user input
     */
    public get input(): string[] {
        return process.argv.slice(2);
    }

    /**
     * Current output buffer
     *
     * @see https://www.alfredapp.com/help/workflows/inputs/script-filter/json
     *
     * @return  Object to be output and interpreted by Alfred
     */
    public get output(): FilterResults {
        if (this.rerun !== null && (this.rerun < 0.1 || this.rerun > 5.0)) {
            throw new Error("Invalid value for rerun, must be between 0.1 and 5.0");
        }

        return {
            rerun: this.rerun,
            items: this.items,
            variables: this.variables,
        };
    }

    /**
     * Run a callback when first script argument matches keyword. Callback will have second argument as query parameter.
     *
     * @example node index.js myaction "my query"
     *
     * @param keyword Action name
     * @param callback Callback to execute when query matches action name
     */
    public action(
        keyword: string,
        callback?: (query: string[]) => void,
    ): Action {
        const action = new Action(keyword, callback);

        this.actions.push(action);

        return action;
    }

    /**
     * Find defined action from arguments and run it.
     *
     * @param args
     *
     * @return Hugo
     */
    public run(args?: string[]) {
        if (!args) {
            args = process.argv.slice(2);
        }

        for (const action of this.actions) {
            if (action.run(args) === true) {
                break;
            }
        }

        return this;
    }

    /**
     * Cache processed file.
     *
     * This allows you to read and process the data once, then storing it in cache until the file has changed again.
     *
     * @param filepath File path
     * @param options Cache options
     */
    public cacheFile(filePath: string, options?: ICacheOptions): FileCache {
        return new FileCache(filePath, options || {
            dir: this.workflowMeta.cache,
        });
    }

    /**
     * Clear cache
     *
     * Clear the whole workflow cache directory.
     */
    public async clearCache() {
        if (this.workflowMeta.cache) {
            return fs.emptyDir(this.workflowMeta.cache);
        }
    }

    /**
     * Clear cache
     *
     * Clear the whole workflow cache directory.
     */
    public clearCacheSync(): void {
        if (this.workflowMeta.cache) {
            fs.emptyDirSync(this.workflowMeta.cache);
        }
    }

    /**
     * Filter list of candidates with fuse.js
     *
     * @see http://fusejs.io
     *
     * @param {Array.<Object>} candidates Input data
     * @param {string} query Search string
     * @param {Object} options fuse.js options
     */
    public match(candidates: Item[], query: string, options?: Fuse.FuseOptions<any>): Item[] {
        options = Object.assign({}, this.fuseDefaults, options || {});

        if (query.trim().length === 0) {
            return candidates;
        }

        // Create fuse.js fuzzy search object
        const fuse = new Fuse(candidates, options);

        // Return results
        return fuse.search(query);
    }

    /**
     * Send a notification
     *
     * Notification title defaults to the Workflow name, or when not available to 'Alfred'.
     * You can adjust all the options that node-notifier supports. Please see their documentation for available options.
     *
     * @see https://github.com/mikaelbr/node-notifier
     *
     * @param notification Notification options
     */
    public async notify(notification: NotificationCenter.Notification) {
        return new Promise((resolve, reject) => {
            const defaults: NotificationCenter.Notification = {
                contentImage: this.workflowMeta.icon,
                title: ("Alfred " + this.workflowMeta.name).trim(),
            };

            // Set options
            notification = Object.assign({}, defaults, notification);

            // Notify
            this.notifier.notify(notification, (err, response) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(response);
            });
        });
    }

    /**
     * Check for updates and notify the user
     *
     * @param pkg Package.json contents. When undefined, will read from file.
     */
    public async checkUpdates(pkg?: any) {
        // No need to check if we're not showing anything, duh.
        if (this.options.checkUpdates !== true ||
                (this.options.updateItem !== true && this.options.updateNotification !== true)) {
            return;
        }

        await this.updater.checkUpdates(this.options.updateSource as string, pkg)
            .then((result) => {
                if (!result) {
                    return;
                }

                // Version information
                const current = this.workflowMeta.version;
                const latest = result.version;

                if (!current) {
                    return;
                }

                // Display notification
                if (Semver.gt(latest, current)) {
                    if (result.checkedOnline === true && this.options.updateNotification === true) {
                        this.notify({
                            message: `Workflow version ${latest} available. Current version: ${current}.`,
                        });
                    }
                    if (this.options.updateItem === true) {
                        // Make sure update item is only added once
                        this.items = this.items.filter((item) => {
                            return item.title !== "Workflow update available!";
                        });

                        this.items.push({
                            title: "Workflow update available!",
                            subtitle: `Version ${latest} is available. Current version: ${current}.`,
                            icon: {
                                path:  this.workflowMeta.icon || "",
                            },
                            arg: result.url,
                            variables: {
                                task: "wfUpdate",
                            },
                        });
                    }
                }
            })
            .catch((err) => {
                if (process.env.alfred_debug === "1") {
                    console.error(err.message);
                }
                return;
            });
    }

    /**
     * Fetch url and parse JSON. Useful for REST APIs.
     *
     * @see https://www.npmjs.com/package/got
     *
     * @param url Url to request
     * @param options http.request options
     * @param ttl Cache lifetime (in seconds). Undefined to disable or false to enable indefinite caching.
     */
    public async fetch(url: string, options?: AxiosRequestConfig, ttl?: number | false) {
        const urlHash = crypto.createHash("md5").update(url).digest("hex");

        // Check cache for a hit
        if (ttl && ttl > 0) {
            if (this.cache.has(urlHash)) {
                return this.cache.get(urlHash);
            }
        }

        // Do request
        return Axios.get(url, options)
            .then((response) => {
                if (ttl && ttl > 0) {
                    this.cache.set(urlHash, response.data, ttl);
                    this.cache.commit();
                }

                return response.data;
            });
    }

    /**
     * Flush the output buffer so Alfred shows our items
     * @async
     */
    public async feedback() {
        // Check for updates
        if (this.options.checkUpdates === true) {
            await this.checkUpdates();
        }

        const output = this.output;

        // Output JSON
        console.log(JSON.stringify(output, null, "\t"));

        // Reset everything
        this.reset();
    }
}
