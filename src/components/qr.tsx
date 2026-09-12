import { ComponentProps } from "react"
import { QrCodeGenerateSvgOptions, renderSVG } from "uqr"

interface QRProps extends ComponentProps<"div"> {
  url: string
  options?: QrCodeGenerateSvgOptions
}
export function QR({ url, options, ...props }: QRProps) {
  return <div dangerouslySetInnerHTML={{ __html: renderSVG(url, options) }} {...props} />
}
