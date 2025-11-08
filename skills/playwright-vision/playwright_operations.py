"""
Playwright Vision Skill Operations
Provides visual inspection capabilities using Playwright MCP
"""

from typing import List, Dict, Optional, Any
import json
import os


class PlaywrightVision:
    """
    Handles visual inspection operations for web pages
    """

    def __init__(self, playwright_mcp):
        """
        Initialize with Playwright MCP connection

        Args:
            playwright_mcp: Connected Playwright MCP instance
        """
        self.playwright = playwright_mcp
        self.screenshot_dir = ".hos/memory/visual/screenshots"
        self._ensure_screenshot_dir()

    def _ensure_screenshot_dir(self):
        """Ensure screenshot directory exists"""
        os.makedirs(self.screenshot_dir, exist_ok=True)

    async def take_screenshot(
        self,
        url: str,
        filename: str,
        full_page: bool = True
    ) -> Dict[str, Any]:
        """
        Take screenshot of page

        Args:
            url: URL to screenshot
            filename: Save location
            full_page: Capture full scrollable page

        Returns:
            Dict with success status and file path
        """
        try:
            page = await self.playwright.new_page()
            await page.goto(url)
            screenshot_path = f"{self.screenshot_dir}/{filename}"
            await page.screenshot(path=screenshot_path, full_page=full_page)
            await page.close()

            return {
                "success": True,
                "path": screenshot_path,
                "url": url,
                "message": f"Screenshot saved to {screenshot_path}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "url": url
            }

    async def check_element_visible(
        self,
        url: str,
        selector: str,
        timeout: int = 5000
    ) -> Dict[str, Any]:
        """
        Check if element is visible

        Args:
            url: Page URL
            selector: CSS selector
            timeout: Max wait time in ms

        Returns:
            Dict with visibility status
        """
        try:
            page = await self.playwright.new_page()
            await page.goto(url)
            element = page.locator(selector)
            is_visible = await element.is_visible(timeout=timeout)

            # Get element info
            element_info = {
                "selector": selector,
                "visible": is_visible
            }

            if is_visible:
                box = await element.bounding_box()
                if box:
                    element_info["position"] = {
                        "x": box["x"],
                        "y": box["y"],
                        "width": box["width"],
                        "height": box["height"]
                    }

            await page.close()

            return {
                "success": True,
                "visible": is_visible,
                "selector": selector,
                "element_info": element_info
            }
        except Exception as e:
            return {
                "success": False,
                "visible": False,
                "error": str(e),
                "selector": selector
            }

    async def test_responsive(
        self,
        url: str,
        devices: List[str]
    ) -> Dict[str, Any]:
        """
        Test page across device sizes

        Args:
            url: Page to test
            devices: List of device names

        Returns:
            Dict with results per device
        """
        device_configs = {
            "iPhone 12": {"width": 390, "height": 844},
            "iPhone 15": {"width": 393, "height": 852},
            "Pixel 7": {"width": 412, "height": 915},
            "iPad": {"width": 768, "height": 1024},
            "iPad Pro": {"width": 1024, "height": 1366},
            "Desktop": {"width": 1920, "height": 1080}
        }

        results = {}

        for device in devices:
            if device not in device_configs:
                results[device] = {"error": "Unknown device"}
                continue

            try:
                config = device_configs[device]
                page = await self.playwright.new_page(
                    viewport=config
                )
                await page.goto(url)

                # Check for layout issues
                has_horizontal_scroll = await page.evaluate(
                    "document.body.scrollWidth > window.innerWidth"
                )

                screenshot_path = f"{self.screenshot_dir}/{device.replace(' ', '-').lower()}.png"
                await page.screenshot(path=screenshot_path)
                await page.close()

                results[device] = {
                    "success": True,
                    "has_horizontal_scroll": has_horizontal_scroll,
                    "screenshot": screenshot_path,
                    "viewport": config
                }
            except Exception as e:
                results[device] = {
                    "success": False,
                    "error": str(e)
                }

        return {
            "success": True,
            "url": url,
            "results": results
        }

    async def validate_design(
        self,
        url: str,
        design_system_path: str
    ) -> Dict[str, Any]:
        """
        Validate page against design system

        Args:
            url: Page to validate
            design_system_path: Path to design specs

        Returns:
            Validation results
        """
        # Load design system rules
        try:
            with open(design_system_path, 'r') as f:
                design_rules = json.load(f)
        except Exception as e:
            return {
                "success": False,
                "error": f"Could not load design system: {str(e)}"
            }

        try:
            page = await self.playwright.new_page()
            await page.goto(url)

            violations = []

            # Check color usage
            if "colors" in design_rules:
                # Extract colors from page
                used_colors = await page.evaluate("""
                    () => {
                        const colors = new Set();
                        document.querySelectorAll('*').forEach(el => {
                            colors.add(getComputedStyle(el).color);
                            colors.add(getComputedStyle(el).backgroundColor);
                        });
                        return Array.from(colors);
                    }
                """)

                # Check against allowed colors
                allowed_colors = design_rules["colors"]
                for color in used_colors:
                    if color not in allowed_colors and color != "rgba(0, 0, 0, 0)":
                        violations.append({
                            "type": "color",
                            "value": color,
                            "rule": "Color not in design system"
                        })

            # Check typography
            if "typography" in design_rules:
                font_families = await page.evaluate("""
                    () => {
                        const fonts = new Set();
                        document.querySelectorAll('*').forEach(el => {
                            fonts.add(getComputedStyle(el).fontFamily);
                        });
                        return Array.from(fonts);
                    }
                """)

                allowed_fonts = design_rules["typography"].get("fonts", [])
                for font in font_families:
                    if font and allowed_fonts and font not in allowed_fonts:
                        violations.append({
                            "type": "typography",
                            "value": font,
                            "rule": "Font not in design system"
                        })

            await page.close()

            return {
                "success": True,
                "valid": len(violations) == 0,
                "violations": violations,
                "url": url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def check_interactions(
        self,
        url: str,
        selector: str,
        action: str,
        expected_result: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if interactive elements work correctly

        Args:
            url: Page URL
            selector: Element selector
            action: Action to perform (click, hover, type, etc.)
            expected_result: What should happen after action

        Returns:
            Interaction test results
        """
        try:
            page = await self.playwright.new_page()
            await page.goto(url)

            element = page.locator(selector)
            is_visible = await element.is_visible()

            if not is_visible:
                await page.close()
                return {
                    "success": False,
                    "error": f"Element {selector} not visible"
                }

            # Perform action
            if action == "click":
                await element.click()
            elif action == "hover":
                await element.hover()
            elif action == "focus":
                await element.focus()
            else:
                await page.close()
                return {
                    "success": False,
                    "error": f"Unknown action: {action}"
                }

            # Check for expected result
            result = {
                "success": True,
                "action": action,
                "selector": selector,
                "element_exists": True
            }

            if expected_result:
                # Wait for expected element or condition
                try:
                    await page.wait_for_selector(expected_result, timeout=2000)
                    result["expected_result_found"] = True
                except:
                    result["expected_result_found"] = False

            await page.close()
            return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


async def main():
    """Example usage"""
    # This would be called by agents
    # vision = PlaywrightVision(playwright_mcp)
    # result = await vision.take_screenshot(...)
    pass


if __name__ == "__main__":
    pass
