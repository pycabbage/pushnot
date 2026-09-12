"use client"

import { ArrowSquareOutIcon, GithubLogoIcon } from "@phosphor-icons/react"

import { Button } from "./ui/button"

export function RepoLink() {
  return (
    <Button
      variant="outline"
      size="default"
      aria-label="View source on GitHub"
      render={
        <a href="https://github.com/pycabbage/pushnot" target="_blank" rel="noopener noreferrer" />
      }
    >
      <GithubLogoIcon />
      <ArrowSquareOutIcon />
    </Button>
  )
}
