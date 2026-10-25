test:
	nix-shell test.nix --command "npx playwright@1.59.1 test"

serve:
	python3 -m http.server 8080
