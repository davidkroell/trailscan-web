// Command wasm is a thin syscall/js adapter around the trailscan core
// library, exposing a small JSON-based API to the browser.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"syscall/js"

	"github.com/davidkroell/trailscan"
)

type analyzeOptions struct {
	QueryTemplate    string  `json:"querytemplate"`
	Query            string  `json:"query"`
	MaxDistance      float64 `json:"max_distance"`
	MaxElevationDiff float64 `json:"max_elevation_diff"`
	SimplifyGPX      bool    `json:"simplify_gpx"`
}

type trackSummaryJSON struct {
	DistanceMeters      float64 `json:"distanceMeters"`
	ElevationGainMeters float64 `json:"elevationGainMeters"`
}

type analyzeResult struct {
	Track    trackSummaryJSON           `json:"track"`
	Features []trailscan.VisitedAmenity `json:"features"`
}

func fetchOptionsFromRequest(opts analyzeOptions) (trailscan.FetchOptions, error) {
	fetchOptions := trailscan.DefaultFetchOptions()

	switch {
	case opts.Query != "":
		fetchOptions.QueryTemplate = opts.Query
	case opts.QueryTemplate != "":
		tmpl, ok := trailscan.AllTemplates[opts.QueryTemplate]
		if !ok {
			return trailscan.FetchOptions{}, fmt.Errorf("unknown query template %q", opts.QueryTemplate)
		}
		fetchOptions.QueryTemplate = tmpl
	}

	return fetchOptions, nil
}

func analyze(gpxText string, optionsJSON string) (analyzeResult, error) {
	var opts analyzeOptions
	if err := json.Unmarshal([]byte(optionsJSON), &opts); err != nil {
		return analyzeResult{}, fmt.Errorf("parsing options: %w", err)
	}

	simplifyDistance := 0.0
	if opts.SimplifyGPX {
		simplifyDistance = opts.MaxDistance / 4
	}

	points, bbox, err := trailscan.LoadGPX(strings.NewReader(gpxText), simplifyDistance)
	if err != nil {
		return analyzeResult{}, fmt.Errorf("loading gpx: %w", err)
	}

	fetchOptions, err := fetchOptionsFromRequest(opts)
	if err != nil {
		return analyzeResult{}, err
	}

	amenities, err := trailscan.FetchAmenities(context.Background(), bbox, fetchOptions)
	if err != nil {
		return analyzeResult{}, fmt.Errorf("fetching amenities: %w", err)
	}

	findOpts := trailscan.DefaultFindOptions()
	if opts.MaxDistance > 0 {
		findOpts.MaxDistanceMeters = opts.MaxDistance
	}
	if opts.MaxElevationDiff > 0 {
		findOpts.MaxElevationDifference = opts.MaxElevationDiff
	}

	visited := trailscan.FindVisitedAmenities(points, amenities, findOpts)
	summary := trailscan.Summarize(points)

	return analyzeResult{
		Track: trackSummaryJSON{
			DistanceMeters:      summary.DistanceMeters,
			ElevationGainMeters: summary.ElevationGainMeters,
		},
		Features: visited,
	}, nil
}

// analyzeJS wraps analyze as a JS function returning a Promise<string>,
// since it performs a network call to Overpass.
func analyzeJS(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return js.ValueOf("expected 2 arguments: gpxText, optionsJSON")
	}

	gpxText := args[0].String()
	optionsJSON := args[1].String()

	handler := js.FuncOf(func(_ js.Value, promiseArgs []js.Value) any {
		resolve := promiseArgs[0]
		reject := promiseArgs[1]

		go func() {
			result, err := analyze(gpxText, optionsJSON)
			if err != nil {
				reject.Invoke(js.ValueOf(err.Error()))
				return
			}

			out, err := json.Marshal(result)
			if err != nil {
				reject.Invoke(js.ValueOf(err.Error()))
				return
			}

			resolve.Invoke(js.ValueOf(string(out)))
		}()

		return nil
	})

	return js.Global().Get("Promise").New(handler)
}

func main() {
	js.Global().Set("trailscan", js.ValueOf(map[string]any{}))
	js.Global().Get("trailscan").Set("analyze", js.FuncOf(analyzeJS))

	js.Global().Call("dispatchEvent", js.Global().Get("CustomEvent").New("trailscan:ready"))

	select {}
}
