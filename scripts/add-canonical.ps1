$rootPath = ".\app\clicker-games"

Get-ChildItem -Path $rootPath -Filter "layout.tsx" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    
    if ($content -notmatch "metadataBase:" -and $content -match "export const metadata: Metadata = {") {
        $relativePath = "clicker-games/" + $_.Directory.FullName.Replace((Resolve-Path $rootPath).Path, '').Replace('\', '/').TrimStart('/')
        
        $newContent = $content -replace "export const metadata: Metadata = {", @"
export const metadata: Metadata = {
  metadataBase: new URL('https://stimulation-clicker.org'),
  alternates: {
    canonical: 'https://stimulation-clicker.org/$relativePath'
  },
"@

        Set-Content $_.FullName $newContent -NoNewline -Encoding UTF8
        Write-Host "Updated: $($_.FullName)"
    }
}