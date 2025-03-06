export default function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container flex flex-col md:flex-row items-center justify-between py-6 gap-4">
        <div className="flex items-center gap-2">
          <span className="font-rubik font-bold">KasPixel</span>
          <span className="text-sm text-muted-foreground font-lato">
            © {new Date().getFullYear()} All rights reserved
          </span>
        </div>

        <div className="flex gap-6">
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-lato">
            Terms of Service
          </a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-lato">
            Privacy Policy
          </a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-lato">
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}

