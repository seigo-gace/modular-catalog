# Design

Retry only transient network failures, HTTP 408, 429, and 5xx responses. Permanent client errors stop immediately.
