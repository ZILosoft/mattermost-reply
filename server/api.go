package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// initRouter initializes the HTTP router for the plugin.
func (p *Plugin) initRouter() *mux.Router {
	router := mux.NewRouter()

	// Middleware to require that the user is logged in
	router.Use(p.MattermostAuthorizationRequired)

	apiRouter := router.PathPrefix("/api/v1").Subrouter()

	apiRouter.HandleFunc("/hello", p.HelloWorld).Methods(http.MethodGet)
	apiRouter.HandleFunc("/config", p.GetConfig).Methods(http.MethodGet)

	return router
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
// The root URL is currently <siteUrl>/plugins/com.mattermost.plugin-starter-template/api/v1/. Replace com.mattermost.plugin-starter-template with the plugin ID.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.router.ServeHTTP(w, r)
}

func (p *Plugin) MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID == "" {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (p *Plugin) HelloWorld(w http.ResponseWriter, r *http.Request) {
	if _, err := w.Write([]byte("Hello, world!")); err != nil {
		p.API.LogError("Failed to write response", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

type publicConfig struct {
	QuoteButtonLabel     string `json:"quoteButtonLabel"`
	SelectionButtonLabel string `json:"selectionButtonLabel"`
	EnableSelectionPopup bool   `json:"enableSelectionPopup"`
	LinkQuotesToSource   bool   `json:"linkQuotesToSource"`
}

func (p *Plugin) GetConfig(w http.ResponseWriter, r *http.Request) {
	config := p.getConfiguration()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(publicConfig{
		QuoteButtonLabel:     config.QuoteButtonLabel,
		SelectionButtonLabel: config.SelectionButtonLabel,
		EnableSelectionPopup: config.enableSelectionPopup(),
		LinkQuotesToSource:   config.linkQuotesToSource(),
	}); err != nil {
		p.API.LogError("Failed to write config response", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
