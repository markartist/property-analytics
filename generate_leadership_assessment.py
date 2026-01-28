#!/usr/bin/env python3
"""
Leadership Property Assessment Report Generator
================================================

Executive-focused performance assessment with accurate Core Web Vitals framing
and conservative, leadership-appropriate language.

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
            "ttfb": "0.8s",
            "has_field_data": True
        },
        "desktop": {
            "performance": 96,
            "lcp": "1.6s",
            "fid": "<100ms",
            "cls": "0.00",
            "fcp": "0.9s"
        },
        "cwv_status": "passing",
        "cwv_explanation": "Currently passing Google Core Web Vitals based on real-user (field) data. Performance benchmark for the portfolio.",
        "schema": {
            "has_schema": True,
            "types": ["WebSite", "WebPage", "Organization"],
            "assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."
        },
        "seo": {
            "title": "Camber Ridge | Luxury Apartments in Fulshear, TX",
            "description": "Welcome home to Camber Ridge Apartments in Fulshear, Texas",
            "og_tags": True,
            "twitter_tags": True,
            "canonical": True,
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
            "ttfb": "1.3s",
            "has_field_data": True
        },
        "desktop": {
            "performance": 92,
            "lcp": "2.0s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.1s"
        },
        "cwv_status": "failing",
        "cwv_explanation": "Currently failing Google Core Web Vitals due to layout shift (CLS > 0.10). Fixable but an active SEO risk.",
        "schema": {
            "has_schema": True,
            "types": ["Multiple structured data instances"],
            "assessment": "More complete structured data than peers, but still lacks full ApartmentComplex / LocalBusiness schema."
        },
        "seo": {
            "title": "Monteverde | Apartments for Rent Near Ingram Park Mall",
            "description": "Discover the perfect balance of open space and upscale comfort",
            "og_tags": True,
            "twitter_tags": True,
            "canonical": True,
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
            "ttfb": "N/A",
            "has_field_data": False
        },
        "desktop": {
            "performance": 90,
            "lcp": "2.3s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.3s"
        },
        "cwv_status": "at_risk",
        "cwv_explanation": "No Google field data yet. Mobile performance is well above Google LCP thresholds (2.5s) and is likely to fail Core Web Vitals once traffic volume increases.",
        "schema": {
            "has_schema": True,
            "types": ["Minimal"],
            "assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."
        },
        "seo": {
            "title": "Sundara at Spring Cypress | Inspired Living in Cypress, Texas",
            "description": "Coming soon landing page",
            "og_tags": True,
            "twitter_tags": True,
            "canonical": True,
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
            "ttfb": "N/A",
            "has_field_data": False
        },
        "desktop": {
            "performance": 89,
            "lcp": "2.1s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.2s"
        },
        "cwv_status": "at_risk",
        "cwv_explanation": "No Google field data yet. Mobile performance is well above Google LCP thresholds (2.5s) and is likely to fail Core Web Vitals once traffic volume increases.",
        "schema": {
            "has_schema": True,
            "types": ["Minimal"],
            "assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."
        },
        "seo": {
            "title": "The Vine Kyle Parkway | Inspired Living in Kyle, Texas",
            "description": "Coming soon landing page",
            "og_tags": True,
            "twitter_tags": True,
            "canonical": True,
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
            "ttfb": "N/A",
            "has_field_data": False
        },
        "desktop": {
            "performance": 90,
            "lcp": "2.4s",
            "fid": "N/A",
            "cls": "0.00",
            "fcp": "1.3s"
        },
        "cwv_status": "at_risk",
        "cwv_explanation": "No Google field data yet. Mobile performance is well above Google LCP thresholds (2.5s) and is likely to fail Core Web Vitals once traffic volume increases.",
        "schema": {
            "has_schema": True,
            "types": ["Minimal"],
            "assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."
        },
        "seo": {
            "title": "Townestone at 359 | Luxury Apartments in Richmond, Texas",
            "description": "Coming soon landing page",
            "og_tags": True,
            "twitter_tags": True,
            "canonical": True,
            "gtm": "GTM-PXD58MGM"
        }
    }
}


def get_cwv_status_label(status):
    """Get display label and style for CWV status"""
    labels = {
        "passing": ("✅ Passing CWV", "healthy"),
        "failing": ("❌ Failing CWV", "action_needed"),
        "at_risk": ("⚠️ At Risk", "watch")
    }
    return labels.get(status, ("Status Unknown", "watch"))


def generate_report():
    """Generate the leadership-focused assessment report"""
    
    builder = ReportBuilder(
        title="Property Assessment",
        subtitle="Performance & Technical SEO Analysis",
        version="1.0.0",
        date_range="Assessment Date: 01/26/2026"
    )
    
    # Executive Summary Section
    executive_summary = Section(
        title="Executive Summary",
        status="healthy",
        description="Key findings and portfolio overview",
        content=f'''
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #0066cc; margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #15284B;">Key Insights</h4>
                <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Desktop performance is strong across all properties.</strong> All sites score 89-96 on desktop metrics.</li>
                    <li><strong>Mobile Largest Contentful Paint (LCP)</strong> — the time it takes for the main content to load — is the primary limiting factor for SEO readiness on 4 of 5 sites.</li>
                    <li><strong>Camber Ridge is the current performance benchmark,</strong> with the only site passing Google's Core Web Vitals assessment.</li>
                    <li><strong>Monteverde has an active SEO risk</strong> due to layout shift issues (CLS > 0.10), but this is fixable.</li>
                </ul>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #856404;">Understanding Core Web Vitals</h4>
                <p style="margin: 0; line-height: 1.6; color: #856404;">
                    <strong>Google evaluates Core Web Vitals primarily on mobile, using real-user data.</strong> 
                    Desktop performance does not offset poor mobile performance. Sites with sufficient traffic 
                    are assessed on actual visitor experience; new sites are assessed on lab testing until 
                    real-user data becomes available.
                </p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #28a745;">
                <h4 style="margin-top: 0; color: #15284B;">Schema & Structured Data</h4>
                <p style="margin: 0; line-height: 1.6;">
                    Current schema implementations meet technical minimums but do not yet provide competitive 
                    advantage in local apartment search. All sites have basic WebSite/Organization markup, 
                    but lack full ApartmentComplex or LocalBusiness structured data that would enhance 
                    visibility in Google's local search results.
                </p>
            </div>
        '''
    )
    builder.add_section(executive_summary)
    
    # Add summary KPI tiles
    tiles = []
    for prop_name, prop_data in PROPERTIES.items():
        mobile_score = prop_data["mobile"]["performance"]
        cwv_label, _ = get_cwv_status_label(prop_data["cwv_status"])
        
        tiles.append(KPITile(
            label=prop_name,
            value=str(mobile_score),
            sublabel=cwv_label,
            is_primary=(prop_name == "Camber Ridge")
        ))
    
    builder.add_kpi_tiles(tiles[:3], columns=3)  # First row
    if len(tiles) > 3:
        builder.add_kpi_tiles(tiles[3:], columns=2)  # Second row
    
    # Generate detailed sections for each property
    for prop_name, prop_data in PROPERTIES.items():
        # Determine status based on CWV
        status_label, status = get_cwv_status_label(prop_data["cwv_status"])
        
        # Build Core Web Vitals section with proper indicators
        lcp_value = prop_data["mobile"]["lcp"]
        cls_value = prop_data["mobile"]["cls"]
        
        # Determine LCP indicator
        if lcp_value != "N/A":
            lcp_numeric = float(lcp_value.replace('s', ''))
            if lcp_numeric <= 2.5:
                lcp_indicator = "🟢"
            elif lcp_numeric <= 4.0:
                lcp_indicator = "🟡"
            else:
                lcp_indicator = "🔴"
        else:
            lcp_indicator = "⚪"
        
        # Determine CLS indicator
        if cls_value != "N/A":
            cls_numeric = float(cls_value)
            if cls_numeric <= 0.1:
                cls_indicator = "🟢"
            elif cls_numeric <= 0.25:
                cls_indicator = "🟡"
            else:
                cls_indicator = "🔴"
        else:
            cls_indicator = "⚪"
        
        mobile_content = f'''
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">📱 Mobile Score</div>
                <div style="font-size: 42px; font-weight: 700; color: #ffc107; line-height: 1;">{prop_data["mobile"]["performance"]}</div>
                <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">PageSpeed Score</div>
            </div>
        '''
        
        mobile_content += create_metric_card("LCP", lcp_value, lcp_indicator, "Goal: <2.5s")
        mobile_content += create_metric_card("FID/INP", prop_data["mobile"]["fid"], "⚪", "Lab data")
        mobile_content += create_metric_card("CLS", cls_value, cls_indicator, "Goal: <0.1")
        mobile_content += create_metric_card("FCP", prop_data["mobile"]["fcp"], "⚪", "Reference")
        
        desktop_content = f'''
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">💻 Desktop Score</div>
                <div style="font-size: 42px; font-weight: 700; color: #28a745; line-height: 1;">{prop_data["desktop"]["performance"]}</div>
                <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">PageSpeed Score</div>
            </div>
        '''
        
        desktop_content += create_metric_card("LCP", prop_data["desktop"]["lcp"], "🟢", "Goal: <2.5s")
        desktop_content += create_metric_card("FID/INP", prop_data["desktop"]["fid"], "⚪", "Lab data")
        desktop_content += create_metric_card("CLS", prop_data["desktop"]["cls"], "🟢", "Goal: <0.1")
        desktop_content += create_metric_card("FCP", prop_data["desktop"]["fcp"], "🟢", "Reference")
        
        cwv_html = create_side_by_side_layout(mobile_content, desktop_content)
        
        # CWV Assessment
        cwv_assessment = f'''
            <div style="background: {'#d4edda' if prop_data['cwv_status'] == 'passing' else '#fff3cd' if prop_data['cwv_status'] == 'at_risk' else '#f8d7da'}; 
                        padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #15284B;">Core Web Vitals Assessment</h4>
                <p style="margin: 0; line-height: 1.6;"><strong>{status_label}:</strong> {prop_data["cwv_explanation"]}</p>
            </div>
        '''
        
        # Schema & SEO section
        schema_html = "<h4>Structured Data</h4>"
        schema_html += f"<p>{prop_data['schema']['assessment']}</p>"
        
        schema_html += "<h4 style='margin-top: 20px;'>Technical SEO Checklist</h4>"
        seo_table = create_data_table(
            headers=["Element", "Status"],
            rows=[
                ["Title Tag", f"✅ Present"],
                ["Meta Description", "✅ Present" if prop_data['seo']['description'] else "❌ Missing"],
                ["OpenGraph Tags", "✅ Configured" if prop_data['seo']['og_tags'] else "⚠️ Not configured"],
                ["Twitter Cards", "✅ Configured" if prop_data['seo']['twitter_tags'] else "⚠️ Not configured"],
                ["Canonical URL", "✅ Set" if prop_data['seo']['canonical'] else "⚠️ Not set"],
                ["GTM Tracking", f"✅ {prop_data['seo']['gtm']}"]
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
            title=f"{prop_name} — {prop_data['location']}",
            status=status,
            description=status_label,
            content=info_html + cwv_html + cwv_assessment + schema_html
        ))
    
    # Add closing insights
    closing_section = Section(
        title="Recommendations",
        status="healthy",
        description="Strategic next steps",
        content='''
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #0066cc;">
                <h4 style="margin-top: 0; color: #15284B;">Summary</h4>
                <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>These sites are structurally sound and launch-ready.</strong> No architectural blockers identified.</li>
                    <li><strong>Mobile performance tuning</strong> represents the largest SEO upside, particularly for Sundara, Vine, and Townestone.</li>
                    <li><strong>Structured data enhancements</strong> (ApartmentComplex schema) would improve visibility in local search.</li>
                    <li><strong>Monteverde's layout shift issue</strong> should be addressed to avoid SEO ranking penalties.</li>
                </ul>
            </div>
        '''
    )
    builder.add_section(closing_section)
    
    return builder


if __name__ == "__main__":
    print("Generating Leadership Property Assessment Report...")
    
    builder = generate_report()
    output_path = "/Users/mark/Downloads/report/Property_Assessment_Leadership.html"
    builder.save(output_path)
    
    print(f"✓ Report generated: {output_path}")
    print(f"  Executive-focused with accurate CWV framing")
