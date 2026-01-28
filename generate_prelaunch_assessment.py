#!/usr/bin/env python3
"""
Pre-Launch Property Assessment Report Generator
===============================================

Generates performance assessment report for pre-launch/coming-soon properties
including Core Web Vitals, Schema validation, and technical SEO analysis.

Usage:
    python3 generate_prelaunch_assessment.py --output assessment_report.html

Author: Mark Laufhutte
Date: 2026-01-26
"""

import sys
from pathlib import Path

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))

from utils.report_builder import (
    ReportBuilder,
    KPITile,
    Section,
    create_side_by_side_layout,
    create_data_table,
    create_metric_card
)


# Property data - Core Web Vitals from PageSpeed Insights
PROPERTIES = {
    "Camber Ridge": {
        "url": "https://camberridgeapartments.com/",
        "location": "Fulshear, TX",
        "mobile": {
            "performance": 55,
            "lcp": "2.2s",
            "fid": "187ms",
            "cls": "0.07",
            "fcp": "1.8s",
            "ttfb": "0.8s"
        },
        "desktop": {
            "performance": 96,
            "lcp": "1.6s",
            "fid": "<100ms",
            "cls": "0.00",
            "fcp": "0.9s"
        },
        "schema": {
            "has_schema": True,
            "types": ["WebSite", "WebPage", "Organization"],
            "issues": []
        },
        "seo": {
            "title": "Camber Ridge | Luxury Apartments in Fulshear, TX",
            "description": "Welcome home to Camber Ridge Apartments in Fulshear, Texas – Experience luxury living in our thoughtfully designed one and two-bedroom homes.",
            "og_tags": True,
            "twitter_tags": True,
            "canonical": True,
            "robots": "max-snippet:-1,max-image-preview:standard,max-video-preview:-1",
            "gtm": "GTM-PCKB59CT"
        }
    },
    "Monteverde": {
        "url": "https://monteverdesatx.com/",
        "location": "San Antonio, TX",
        "mobile": {
            "performance": 69,
            "lcp": "7.2s",
            "fid": "N/A",
            "cls": "0.12",
            "fcp": "2.3s",
            "ttfb": "1.3s"
        },
        "desktop": {
            "performance": 92,
            "lcp": "2.0s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.1s"
        },
        "schema": {
            "has_schema": True,
            "types": ["Multiple instances found"],
            "issues": []
        },
        "seo": {
            "title": "Monteverde | Apartments for Rent Near Ingram Park Mall",
            "description": "Discover the perfect balance of open space and upscale comfort at Monteverde on San Antonio's west side.",
            "og_tags": False,
            "twitter_tags": False,
            "canonical": False,
            "robots": "WP Rocket optimization",
            "gtm": "GTM-MVHLFHDR"
        }
    },
    "Sundara (Cypress)": {
        "url": "https://whatscomingtocypress.com/",
        "location": "Cypress, TX",
        "mobile": {
            "performance": 54,
            "lcp": "11.6s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "4.8s",
            "ttfb": "N/A"
        },
        "desktop": {
            "performance": 90,
            "lcp": "2.3s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.3s"
        },
        "schema": {
            "has_schema": True,
            "types": ["Minimal"],
            "issues": ["Limited structured data"]
        },
        "seo": {
            "title": "Sundara at Spring Cypress | Inspired Living in Cypress, Texas",
            "description": "Coming soon landing page",
            "og_tags": False,
            "twitter_tags": False,
            "canonical": False,
            "robots": "Default",
            "gtm": "GTM-MVHLFHDR"
        }
    },
    "Vine Kyle": {
        "url": "https://whatscomingtokyle.com/",
        "location": "Kyle, TX",
        "mobile": {
            "performance": 50,
            "lcp": "9.4s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "3.3s",
            "ttfb": "N/A"
        },
        "desktop": {
            "performance": 89,
            "lcp": "2.1s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.2s"
        },
        "schema": {
            "has_schema": True,
            "types": ["Minimal"],
            "issues": ["Limited structured data"]
        },
        "seo": {
            "title": "The Vine Kyle Parkway | Inspired Living in Kyle, Texas",
            "description": "Coming soon landing page",
            "og_tags": False,
            "twitter_tags": False,
            "canonical": False,
            "robots": "Default",
            "gtm": "GTM-MVHLFHDR"
        }
    },
    "Townestone": {
        "url": "https://townestoneat359.com/",
        "location": "Richmond, TX",
        "mobile": {
            "performance": 47,
            "lcp": "14.5s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "3.3s",
            "ttfb": "N/A"
        },
        "desktop": {
            "performance": 90,
            "lcp": "2.4s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.3s"
        },
        "schema": {
            "has_schema": True,
            "types": ["Minimal"],
            "issues": ["Limited structured data"]
        },
        "seo": {
            "title": "Townestone at 359 | Luxury Apartments in Richmond, Texas",
            "description": "Coming soon landing page",
            "og_tags": False,
            "twitter_tags": False,
            "canonical": False,
            "robots": "Default",
            "gtm": "GTM-PXD58MGM"
        }
    }
}


def grade_performance(score):
    """Convert PageSpeed score to letter grade"""
    if score is None:
        return "—", "No Data"
    elif score >= 90:
        return "A", "Good"
    elif score >= 50:
        return "C", "Needs Improvement"
    else:
        return "F", "Poor"


def generate_report():
    """Generate the pre-launch assessment report"""
    
    builder = ReportBuilder(
        title="Property Assessment",
        subtitle="Performance & Technical SEO Analysis",
        version="1.0.0",
        date_range="Assessment Date: 01/26/2026"
    )
    
    # Add summary KPI tiles
    tiles = []
    for prop_name, prop_data in PROPERTIES.items():
        mobile_score = prop_data["mobile"]["performance"]
        grade, label = grade_performance(mobile_score)
        
        tiles.append(KPITile(
            label=prop_name,
            value=str(mobile_score) if mobile_score is not None else "—",
            grade=grade if mobile_score is not None else "—",
            grade_label=label,
            is_primary=(prop_name == "Camber Ridge")  # Highlight first property
        ))
    
    builder.add_kpi_tiles(tiles[:3], columns=3)  # First row
    if len(tiles) > 3:
        builder.add_kpi_tiles(tiles[3:], columns=2)  # Second row
    
    # Generate detailed sections for each property
    for prop_name, prop_data in PROPERTIES.items():
        # Determine status
        mobile_score = prop_data["mobile"]["performance"]
        if mobile_score is None:
            status = "watch"
        elif mobile_score >= 90:
            status = "healthy"
        elif mobile_score >= 50:
            status = "watch"
        else:
            status = "action_needed"
        
        # Build Core Web Vitals section
        mobile_content = f'''
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">📱 Mobile Score</div>
                <div style="font-size: 42px; font-weight: 700; color: #ffc107; line-height: 1;">{prop_data["mobile"]["performance"] or "—"}</div>
                <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Performance</div>
            </div>
        '''
        
        mobile_content += create_metric_card("LCP", f'{prop_data["mobile"]["lcp"] or "—"}', "🔴", "<2.5s")
        mobile_content += create_metric_card("FID/INP", f'{prop_data["mobile"]["fid"] or "—"}', "🟡", "<100ms")
        mobile_content += create_metric_card("CLS", f'{prop_data["mobile"]["cls"] or "—"}', "🟢", "<0.1")
        mobile_content += create_metric_card("FCP", f'{prop_data["mobile"]["fcp"] or "—"}', "🟡", "<1.8s")
        
        desktop_content = f'''
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">💻 Desktop Score</div>
                <div style="font-size: 42px; font-weight: 700; color: #28a745; line-height: 1;">{prop_data["desktop"]["performance"] or "—"}</div>
                <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Performance</div>
            </div>
        '''
        
        desktop_content += create_metric_card("LCP", f'{prop_data["desktop"]["lcp"] or "—"}', "🟢", "<2.5s")
        desktop_content += create_metric_card("FID/INP", f'{prop_data["desktop"]["fid"] or "—"}', "🟡", "<100ms")
        desktop_content += create_metric_card("CLS", f'{prop_data["desktop"]["cls"] or "—"}', "🟢", "<0.1")
        desktop_content += create_metric_card("FCP", f'{prop_data["desktop"]["fcp"] or "—"}', "🟢", "<1.8s")
        
        cwv_html = create_side_by_side_layout(mobile_content, desktop_content)
        
        # Schema & SEO section
        schema_html = "<h4>Schema.org Structured Data</h4>"
        if prop_data["schema"]["has_schema"]:
            schema_html += f"<p>✅ <strong>Types Found:</strong> {', '.join(prop_data['schema']['types'])}</p>"
        else:
            schema_html += "<p>❌ No structured data found</p>"
        
        if prop_data["schema"]["issues"]:
            schema_html += f"<p>⚠️ <strong>Issues:</strong> {', '.join(prop_data['schema']['issues'])}</p>"
        
        schema_html += "<h4 style='margin-top: 20px;'>Technical SEO</h4>"
        seo_table = create_data_table(
            headers=["Element", "Status"],
            rows=[
                ["Title Tag", f"✅ {prop_data['seo']['title'][:50]}..."],
                ["Meta Description", "✅ Present" if prop_data['seo']['description'] else "❌ Missing"],
                ["OpenGraph Tags", "✅ Configured" if prop_data['seo']['og_tags'] else "❌ Missing"],
                ["Twitter Cards", "✅ Configured" if prop_data['seo']['twitter_tags'] else "❌ Missing"],
                ["Canonical URL", "✅ Set" if prop_data['seo']['canonical'] else "❌ Missing"],
                ["GTM Tracking", f"✅ {prop_data['seo']['gtm']}"],
                ["Robots Meta", prop_data['seo']['robots']]
            ]
        )
        schema_html += seo_table
        
        # Property info
        info_html = f'''
            <p><strong>URL:</strong> <a href="{prop_data['url']}" target="_blank">{prop_data['url']}</a></p>
            <p><strong>Location:</strong> {prop_data['location']}</p>
        '''
        
        # Add property section
        builder.add_section(Section(
            title=f"{prop_name} - {prop_data['location']}",
            status=status,
            description="Core Web Vitals, Schema, and Technical SEO Analysis",
            content=info_html + cwv_html + schema_html
        ))
    
    return builder


if __name__ == "__main__":
    print("Generating Pre-Launch Property Assessment Report...")
    print("\n⚠️  NOTE: PageSpeed scores need to be manually added to PROPERTIES dict in this script")
    print("    Edit the None values with actual scores from PageSpeed Insights screenshots\n")
    
    builder = generate_report()
    output_path = "/Users/mark/Downloads/report/PreLaunch_Assessment_Report.html"
    builder.save(output_path)
    
    print(f"✓ Report generated: {output_path}")
    print(f"  Open in browser to view the assessment")
