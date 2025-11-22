{ pkgs ? import <nixpkgs> {} }:
  pkgs.mkShell {
    nativeBuildInputs = with pkgs; [
      pkgs.nodejs_24
      playwright-driver.browsers
    ];

    shellHook = ''
      export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
      export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
      python3 -m http.server 3000 &> http-server.log &
      trap "kill %1" EXIT
      npm install @playwright/test@1.52.0
      npx playwright@1.52.0 test
    '';
}
