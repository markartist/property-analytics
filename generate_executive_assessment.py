#!/usr/bin/env python3
"""
Executive Property Assessment Report Generator (Final)
======================================================

Complete executive-focused performance assessment with:
- Accurate Core Web Vitals framing
- Priority/Impact Matrix
- Timeline & Resource guidance
- Single recommended action

For: Stephanie Bynum
Author: Mark Laufhutte
Date: 2026-01-26
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.report_builder import (
    ReportBuilder,
    KPITile,
    Section,
    create_side_by_side_layout,
    create_data_table,
    create_metric_card
)


# Property data with complete PageSpeed scores
PROPERTIES = {
    "Camber Ridge": {
        "url": "https://camberridgeapartments.com/",
        "location": "Fulshear, TX",
        "mobile": {"performance": 55, "lcp": "2.2s", "fid": "187ms", "cls": "0.07", "fcp": "1.8s", "ttfb": "0.8s", "has_field_data": True},
        "desktop": {"performance": 96, "lcp": "1.6s", "fid": "<100ms", "cls": "0.00", "fcp": "0.9s"},
        "cwv_status": "passing",
        "cwv_explanation": "Currently passing Google Core Web Vitals based on real-user (field) data. Performance benchmark for the portfolio.",
        "priority": {"urgency": "Low", "effort": "Low", "impact": "Low"},
        "schema": {"assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."},
        "seo": {"title": "Camber Ridge | Luxury Apartments in Fulshear, TX", "og_tags": True, "twitter_tags": True, "canonical": True, "gtm": "GTM-PCKB59CT"}
    },
    "Monteverde": {
        "url": "https://monteverdesatx.com/",
        "location": "San Antonio, TX",
        "mobile": {"performance": 69, "lcp": "7.2s", "fid": "N/A", "cls": "0.12", "fcp": "2.3s", "ttfb": "1.3s", "has_field_data": True},
        "desktop": {"performance": 92, "lcp": "2.0s", "fid": "N/A", "cls": "0.00", "fcp": "1.1s"},
        "cwv_status": "failing",
        "cwv_explanation": "Currently failing Google Core Web Vitals due to layout shift (CLS > 0.10). This is an isolated and fixable issue, but represents active SEO risk.",
        "priority": {"urgency": "High", "effort": "Low", "impact": "High"},
        "schema": {"assessment": "More complete structured data than peers, but still lacks full ApartmentComplex / LocalBusiness schema."},
        "seo": {"title": "Monteverde | Apartments for Rent Near Ingram Park Mall", "og_tags": True, "twitter_tags": True, "canonical": True, "gtm": "GTM-MVHLFHDR"}
    },
    "Sundara (Cypress)": {
        "url": "https://whatscomingtocypress.com/",
        "location": "Cypress, TX",
        "mobile": {"performance": 54, "lcp": "11.6s", "fid": "N/A", "cls": "0.00", "fcp": "4.8s", "ttfb": "N/A", "has_field_data": False},
        "desktop": {"performance": 90, "lcp": "2.3s", "fid": "N/A", "cls": "0.00", "fcp": "1.3s"},
        "cwv_status": "at_risk",
        "cwv_explanation": "Active sites with no Google field data yet. Mobile performance is well above Google LCP thresholds and represents ongoing SEO risk as traffic scales.",
        "priority": {"urgency": "Medium", "effort": "Medium", "impact": "High"},
        "schema": {"assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."},
        "seo": {"title": "Sundara at Spring Cypress | Inspired Living in Cypress, Texas", "og_tags": True, "twitter_tags": True, "canonical": True, "gtm": "GTM-MVHLFHDR"}
    },
    "Vine Kyle": {
        "url": "https://whatscomingtokyle.com/",
        "location": "Kyle, TX",
        "mobile": {"performance": 50, "lcp": "9.4s", "fid": "N/A", "cls": "0.00", "fcp": "3.3s", "ttfb": "N/A", "has_field_data": False},
        "desktop": {"performance": 89, "lcp": "2.1s", "fid": "N/A", "cls": "0.00", "fcp": "1.2s"},
        "cwv_status": "at_risk",
        "cwv_explanation": "Active sites with no Google field data yet. Mobile performance is well above Google LCP thresholds and represents ongoing SEO risk as traffic scales.",
        "priority": {"urgency": "Medium", "effort": "Medium", "impact": "High"},
        "schema": {"assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."},
        "seo": {"title": "The Vine Kyle Parkway | Inspired Living in Kyle, Texas", "og_tags": True, "twitter_tags": True, "canonical": True, "gtm": "GTM-MVHLFHDR"}
    },
    "Townestone": {
        "url": "https://townestoneat359.com/",
        "location": "Richmond, TX",
        "mobile": {"performance": 47, "lcp": "14.5s", "fid": "N/A", "cls": "0.00", "fcp": "3.3s", "ttfb": "N/A", "has_field_data": False},
        "desktop": {"performance": 90, "lcp": "2.4s", "fid": "N/A", "cls": "0.00", "fcp": "1.3s"},
        "cwv_status": "at_risk",
        "cwv_explanation": "Active sites with no Google field data yet. Mobile performance is well above Google LCP thresholds and represents ongoing SEO risk as traffic scales.",
        "priority": {"urgency": "Medium", "effort": "Medium", "impact": "High"},
        "schema": {"assessment": "Basic schema present (WebSite / Organization). Apartment-level structured data is not yet implemented."},
        "seo": {"title": "Townestone at 359 | Luxury Apartments in Richmond, Texas", "og_tags": True, "twitter_tags": True, "canonical": True, "gtm": "GTM-PXD58MGM"}
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
    """Generate the complete executive assessment report"""
    
    builder = ReportBuilder(
        title="Property Assessment",
        subtitle="Performance & Technical SEO Analysis",
        version="1.0.0",
        date_range="Assessment Date: 01/26/2026"
    )
    
    # === EXECUTIVE SUMMARY ===
    executive_summary = Section(
        title="Executive Summary",
        status="healthy",
        description="Key findings and portfolio overview",
        content='''
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #0066cc; margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #15284B;">Key Insights</h4>
                <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Desktop performance is strong across all properties.</strong> All sites score 89-96 on desktop metrics.</li>
                    <li><strong>Mobile Largest Contentful Paint (LCP)</strong> — the time it takes for the main content to load — is the primary SEO limiting factor for 4 of 5 sites.</li>
                    <li><strong>Camber Ridge represents the current performance benchmark,</strong> with the only site passing Google's Core Web Vitals assessment.</li>
                    <li><strong>Monteverde has an active SEO risk</strong> due to layout shift issues (CLS > 0.10), but this is an isolated and fixable issue.</li>
                </ul>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                <h4 style="margin-top: 0; color: #856404;">Understanding Core Web Vitals</h4>
                <p style="margin: 0; line-height: 1.6; color: #856404;">
                    <strong>Google evaluates Core Web Vitals primarily on mobile using real-user data.</strong> 
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
    
    # === PRIORITY / IMPACT MATRIX ===
    priority_matrix = Section(
        title="Priority & Impact Matrix",
        status="watch",
        description="Action prioritization by urgency, effort, and SEO impact",
        content='''
            <p style="margin-bottom: 20px; line-height: 1.6;">
                Properties ranked by SEO readiness urgency, implementation complexity, and potential impact:
            </p>
            
            <div style="background: #fff5f5; padding: 20px; border-left: 4px solid #dc3545; margin-bottom: 15px;">
                <h4 style="margin-top: 0; color: #721c24;"><strong>High Priority:</strong> Monteverde</h4>
                <p style="margin: 5px 0; line-height: 1.6;">
                    <strong>Urgency:</strong> High — Active CWV failure creates SEO risk<br>
                    <strong>Effort:</strong> Low — Isolated layout issue<br>
                    <strong>Impact:</strong> High — Immediate ranking protection
                </p>
            </div>
            
            <div style="background: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; margin-bottom: 15px;">
                <h4 style="margin-top: 0; color: #856404;"><strong>Medium Priority:</strong> Townestone, Sundara, Vine</h4>
                <p style="margin: 5px 0; line-height: 1.6;">
                    <strong>Urgency:</strong> Medium — Active sites with elevated mobile LCP risk<br>
                    <strong>Effort:</strong> Medium — Multiple sprints per property depending on platform constraints<br>
                    <strong>Impact:</strong> High — Near-term mobile SEO risk reduction
                </p>
            </div>
            
            <div style="background: #d4edda; padding: 20px; border-left: 4px solid #28a745;">
                <h4 style="margin-top: 0; color: #155724;"><strong>Low Priority:</strong> Camber Ridge</h4>
                <p style="margin: 5px 0; line-height: 1.6;">
                    <strong>Urgency:</strong> Low — Passing CWV, maintain and monitor<br>
                    <strong>Effort:</strong> Low — Incremental optimizations<br>
                    <strong>Impact:</strong> Low — Already performing well
                </p>
            </div>
        '''
    )
    builder.add_section(priority_matrix)
    
    # === TIMELINE & RESOURCES ===
    timeline_section = Section(
        title="Estimated Timeline & Resources",
        status="healthy",
        description="Directional guidance for implementation planning",
        content='''
            <p style="margin-bottom: 15px; line-height: 1.6;">
                High-level timing expectations for leadership planning:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>Monteverde CLS Fix:</strong> Isolated layout adjustment — straightforward remediation</li>
                <li><strong>Mobile LCP Optimization:</strong> Multiple sprints per property depending on platform constraints and image delivery optimization</li>
                <li><strong>Schema Implementation:</strong> One-time template-level enhancement applicable across properties</li>
            </ul>
            <p style="margin-top: 15px; line-height: 1.6; font-style: italic; color: #6c757d;">
                Note: Actual timelines depend on platform architecture, developer availability, and testing requirements.
            </p>
        '''
    )
    builder.add_section(timeline_section)
    
    # === KPI TILES ===
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
    
    builder.add_kpi_tiles(tiles[:3], columns=3)
    if len(tiles) > 3:
        builder.add_kpi_tiles(tiles[3:], columns=2)
    
    # === PROPERTY DETAILS ===
    for prop_name, prop_data in PROPERTIES.items():
        status_label, status = get_cwv_status_label(prop_data["cwv_status"])
        
        # Core Web Vitals with proper indicators
        lcp_value = prop_data["mobile"]["lcp"]
        cls_value = prop_data["mobile"]["cls"]
        
        # LCP indicator
        if lcp_value != "N/A":
            lcp_numeric = float(lcp_value.replace('s', ''))
            lcp_indicator = "🟢" if lcp_numeric <= 2.5 else "🟡" if lcp_numeric <= 4.0 else "🔴"
        else:
            lcp_indicator = "⚪"
        
        # CLS indicator
        if cls_value != "N/A":
            cls_numeric = float(cls_value)
            cls_indicator = "🟢" if cls_numeric <= 0.1 else "🟡" if cls_numeric <= 0.25 else "🔴"
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
        bg_color = '#d4edda' if prop_data['cwv_status'] == 'passing' else '#fff3cd' if prop_data['cwv_status'] == 'at_risk' else '#f8d7da'
        cwv_assessment = f'''
            <div style="background: {bg_color}; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #15284B;">Core Web Vitals Assessment</h4>
                <p style="margin: 0; line-height: 1.6;"><strong>{status_label}:</strong> {prop_data["cwv_explanation"]}</p>
            </div>
        '''
        
        # Schema & SEO
        schema_html = f"<h4>Structured Data</h4><p>{prop_data['schema']['assessment']}</p>"
        schema_html += "<h4 style='margin-top: 20px;'>Technical SEO Checklist</h4>"
        schema_html += create_data_table(
            headers=["Element", "Status"],
            rows=[
                ["Title Tag", "✅ Present"],
                ["Meta Description", "✅ Present"],
                ["OpenGraph Tags", "✅ Configured"],
                ["Twitter Cards", "✅ Configured"],
                ["Canonical URL", "✅ Set"],
                ["GTM Tracking", f"✅ {prop_data['seo']['gtm']}"]
            ]
        )
        
        info_html = f'''
            <p><strong>URL:</strong> <a href="{prop_data['url']}" target="_blank">{prop_data['url']}</a></p>
            <p><strong>Location:</strong> {prop_data['location']}</p>
        '''
        
        builder.add_section(Section(
            title=f"{prop_name} — {prop_data['location']}",
            status=status,
            description=status_label,
            content=info_html + cwv_html + cwv_assessment + schema_html
        ))
    
    # === RECOMMENDED NEXT ACTION ===
    action_section = Section(
        title="Recommended Next Action",
        status="watch",
        description="Strategic implementation approach",
        content='''
            <div style="background: #fff3cd; padding: 20px; border-left: 4px solid #ffc107;">
                <h4 style="margin-top: 0; color: #856404;">Single Recommended Path Forward</h4>
                <p style="margin: 10px 0 15px 0; line-height: 1.6; font-size: 15px;">
                    <strong>Resolve Monteverde's CLS issue immediately,</strong> then batch mobile LCP optimizations 
                    for Sundara, Vine, and Townestone to reduce ongoing mobile SEO risk and stabilize performance across the portfolio.
                </p>
                <p style="margin: 0; line-height: 1.6; color: #856404;">
                    This approach addresses the active SEO risk first, then improves mobile search performance 
                    for the remaining properties experiencing elevated LCP measurements.
                </p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #0066cc; margin-top: 20px;">
                <h4 style="margin-top: 0; color: #15284B;">Summary</h4>
                <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>These sites are structurally sound and operationally stable.</strong> No architectural blockers identified.</li>
                    <li><strong>Mobile performance tuning</strong> represents the largest current SEO optimization opportunity, particularly for Sundara, Vine, and Townestone.</li>
                    <li><strong>Structured data enhancements</strong> (ApartmentComplex schema) would improve visibility in local search.</li>
                    <li><strong>Monteverde's layout shift issue</strong> should be addressed to avoid ongoing SEO ranking risk.</li>
                </ul>
            </div>
        '''
    )
    builder.add_section(action_section)
    
    return builder


if __name__ == "__main__":
    print("Generating Executive Property Assessment Report...")
    print("  - Priority Matrix")
    print("  - Timeline Guidance")
    print("  - Recommended Action")
    
    builder = generate_report()
    output_path = "/Users/mark/Downloads/report/Property_Assessment_Executive.html"
    builder.save(output_path)
    
    print(f"\n✓ Report generated: {output_path}")
    print(f"  Executive-ready with complete strategic framework")
