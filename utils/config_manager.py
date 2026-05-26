#!/usr/bin/env python3
"""
Unified Configuration Manager
==============================
Centralized configuration and path management for Property Analytics system.

Features:
- Single source of truth for all paths
- Environment-aware configuration
- Validation of required files
- Easy to update paths globally
- Support for environment variables
- Keeper-first credential resolution for migrated workflows

Usage:
    from utils.config_manager import Config

    # Get database path
    db_path = Config.get_db_path()

    # Get registry path
    registry = Config.get_registry_path()

    # Get credentials
    ga4_creds = Config.get_ga4_credentials_path()
"""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any
from utils.google_ads_ksm import materialize_google_ads_yaml
from utils.keeper_file_materializer import materialize_keeper_file


class ConfigError(Exception):
    """Configuration-related errors"""
    pass


class Config:
    """Centralized configuration manager for Property Analytics"""

    # Base directory (Property_Analytics root)
    BASE_DIR = Path(__file__).parent.parent

    # =========================================================================
    # DATABASE PATHS
    # =========================================================================

    @staticmethod
    def get_db_path() -> Path:
        """
        Get canonical database path.

        Supports PORTFOLIO_ANALYTICS_DB_PATH environment variable override.

        Returns:
            Path to portfolio_analytics.db
        """
        env_path = os.getenv('PORTFOLIO_ANALYTICS_DB_PATH')
        if env_path:
            return Path(env_path)
        return Config.BASE_DIR / 'data' / 'portfolio_analytics.db'

    # =========================================================================
    # REGISTRY & CONFIG PATHS
    # =========================================================================

    @staticmethod
    def get_registry_path() -> Path:
        """
        Get property registry path.

        Returns:
            Path to venterra_properties_official.json
        """
        return Config.BASE_DIR / 'config' / 'venterra_properties_official.json'

    @staticmethod
    def get_email_config_path() -> Path:
        """
        Get email configuration path.

        Note:
            Email config is still file-backed today. Keeper is the repo-wide
            default for newly migrated secrets, but email has not yet been
            moved behind the shared KSM helpers.

        Returns:
            Path to email_config.json
        """
        return Config.BASE_DIR / 'credentials' / 'email_config.json'

    # =========================================================================
    # CREDENTIALS PATHS
    # =========================================================================

    @staticmethod
    def get_ga4_credentials_path() -> Path:
        """
        Get GA4 service account credentials path.

        Supports GA4_CREDENTIALS_PATH environment variable override.
        Prefers Keeper-backed temp-file materialization when configured.

        Returns:
            Path to GA4 service account JSON
        """
        env_path = os.getenv('GA4_CREDENTIALS_PATH')
        if env_path:
            return Path(env_path)

        return materialize_keeper_file(
            uid_env_var='KSM_GA4_SERVICE_ACCOUNT_UID',
            fallback_path='/Users/mark/Spotlight_Properties_Report/config/venterra-property-analytics-8e67b1bcc684.json',
        )

    @staticmethod
    def get_gsc_credentials_path() -> Path:
        """
        Get Google Search Console credentials path.

        Prefers Keeper-backed temp-file materialization when configured.

        Returns:
            Path to GSC credentials JSON
        """
        return materialize_keeper_file(
            uid_env_var='KSM_GSC_CLIENT_SECRET_UID',
            fallback_path=str(Config.BASE_DIR / 'credentials' / 'client_secret.json'),
        )

    @staticmethod
    def get_gbp_credentials_path() -> Path:
        """
        Get Google Business Profile OAuth client credentials path.

        Prefers Keeper-backed temp-file materialization when configured.

        Returns:
            Path to GBP OAuth client JSON
        """
        return materialize_keeper_file(
            uid_env_var='KSM_GBP_CLIENT_SECRET_UID',
            fallback_path=str(Config.BASE_DIR / 'Portfolio_Monitoring' / 'credentials' / 'client_secret_gbp.json'),
        )

    @staticmethod
    def get_gbp_token_path() -> Path:
        """
        Get Google Business Profile OAuth token path.

        Prefers Keeper-backed temp-file materialization when configured.

        Returns:
            Path to GBP OAuth token pickle
        """
        return materialize_keeper_file(
            uid_env_var='KSM_GBP_TOKEN_UID',
            fallback_path=str(Config.BASE_DIR / 'Portfolio_Monitoring' / 'credentials' / 'gbp_token.json'),
        )

    @staticmethod
    def get_google_ads_credentials_path() -> Path:
        """
        Get Google Ads API credentials path.

        Prefers Keeper-backed temp-file materialization when configured.

        Returns:
            Path to Google Ads YAML config
        """
        return materialize_google_ads_yaml(
            file_fallback=str(Config.BASE_DIR / 'Portfolio_Monitoring' / 'google-ads.yaml')
        )

    @staticmethod
    def get_semrush_api_key_path() -> Path:
        """
        Get SEMRush API key file path.

        Returns:
            Path to semrush_api_key.txt
        """
        # Check standard location first
        standard_path = Config.BASE_DIR / 'credentials' / 'semrush_api_key.txt'
        if standard_path.exists():
            return standard_path

        # Fallback to Spotlight location
        return Config.BASE_DIR / 'Spotlight_Properties_Report' / 'config' / 'semrush_api_key.txt'

    @staticmethod
    def get_gtmetrix_api_key_path() -> Path:
        """
        Get GTMetrix API key file path.

        Returns:
            Path to GTMetrix_API_Key.txt
        """
        # Check standard location first
        standard_path = Config.BASE_DIR / 'credentials' / 'gtmetrix_api_key.txt'
        if standard_path.exists():
            return standard_path

        # Fallback to Spotlight location
        return Config.BASE_DIR / 'Spotlight_Properties_Report' / 'config' / 'GTMetrix_API_Key.txt'

    # =========================================================================
    # DIRECTORY PATHS
    # =========================================================================

    @staticmethod
    def get_data_dir() -> Path:
        """Get data directory path"""
        return Config.BASE_DIR / 'data'

    @staticmethod
    def get_logs_dir() -> Path:
        """Get logs directory path"""
        return Config.BASE_DIR / 'logs'

    @staticmethod
    def get_reports_dir() -> Path:
        """Get reports directory path"""
        return Config.BASE_DIR / 'reports'

    @staticmethod
    def get_config_dir() -> Path:
        """Get config directory path"""
        return Config.BASE_DIR / 'config'

    @staticmethod
    def get_credentials_dir() -> Path:
        """Get credentials directory path"""
        return Config.BASE_DIR / 'credentials'

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    @staticmethod
    def ensure_dir_exists(path: Path) -> Path:
        """
        Ensure a directory exists, creating it if necessary.

        Args:
            path: Directory path

        Returns:
            The path (for chaining)
        """
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def validate_file_exists(path: Path, description: str) -> None:
        """
        Validate that a required file exists.

        Args:
            path: File path to check
            description: Human-readable description for error messages

        Raises:
            ConfigError: If file doesn't exist
        """
        if not path.exists():
            raise ConfigError(
                f"{description} not found at: {path}\n"
                f"Please ensure the file exists or set the appropriate environment variable."
            )

    @staticmethod
    def load_registry() -> Dict[str, Any]:
        """
        Load property registry.

        Returns:
            Registry data as dictionary

        Raises:
            ConfigError: If registry cannot be loaded
        """
        registry_path = Config.get_registry_path()
        Config.validate_file_exists(registry_path, "Property registry")

        try:
            with open(registry_path) as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ConfigError(f"Invalid JSON in registry: {e}")
        except Exception as e:
            raise ConfigError(f"Failed to load registry: {e}")

    @staticmethod
    def load_email_config() -> Dict[str, Any]:
        """
        Load email configuration.

        Returns:
            Email config as dictionary

        Raises:
            ConfigError: If config cannot be loaded
        """
        config_path = Config.get_email_config_path()
        Config.validate_file_exists(config_path, "Email configuration")

        try:
            with open(config_path) as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ConfigError(f"Invalid JSON in email config: {e}")
        except Exception as e:
            raise ConfigError(f"Failed to load email config: {e}")

    @staticmethod
    def read_api_key(path: Path, description: str) -> str:
        """
        Read API key from file.

        Args:
            path: Path to API key file
            description: Description for error messages

        Returns:
            API key as string (stripped)

        Raises:
            ConfigError: If API key cannot be read
        """
        Config.validate_file_exists(path, description)

        try:
            with open(path) as f:
                return f.read().strip()
        except Exception as e:
            raise ConfigError(f"Failed to read {description}: {e}")

    # =========================================================================
    # ENVIRONMENT INFO
    # =========================================================================

    @staticmethod
    def get_environment() -> str:
        """
        Get current environment (dev/prod).

        Returns:
            'dev' or 'prod' based on PROPERTY_ANALYTICS_ENV
        """
        return os.getenv('PROPERTY_ANALYTICS_ENV', 'prod')

    @staticmethod
    def is_dev() -> bool:
        """Check if running in development environment"""
        return Config.get_environment() == 'dev'

    @staticmethod
    def is_prod() -> bool:
        """Check if running in production environment"""
        return Config.get_environment() == 'prod'

    # =========================================================================
    # VALIDATION
    # =========================================================================

    @staticmethod
    def validate_setup(verbose: bool = False) -> bool:
        """
        Validate that required files and directories exist.

        Args:
            verbose: Print status messages

        Returns:
            True if all validations pass

        Raises:
            ConfigError: If validation fails
        """
        if verbose:
            print("🔍 Validating configuration setup...")

        validations = [
            (Config.get_db_path().parent, "Database directory"),
            (Config.get_registry_path(), "Property registry"),
            (Config.get_ga4_credentials_path(), "GA4 credentials"),
        ]

        for path, description in validations:
            if not path.exists():
                raise ConfigError(f"{description} not found: {path}")
            if verbose:
                print(f"   ✅ {description}: {path}")

        if verbose:
            print("✅ Configuration validation complete")

        return True


# Convenience function for backward compatibility
def get_db_path() -> Path:
    """Get database path (backward compatible)"""
    return Config.get_db_path()


def connect_db():
    """Get database connection (backward compatible)"""
    import sqlite3
    return sqlite3.connect(Config.get_db_path())


if __name__ == '__main__':
    """CLI for testing configuration"""
    print("=" * 70)
    print("📋 PROPERTY ANALYTICS CONFIGURATION")
    print("=" * 70)
    print()

    print("Database:")
    print(f"  {Config.get_db_path()}")
    print()

    print("Registry:")
    print(f"  {Config.get_registry_path()}")
    print()

    print("Credentials:")
    print(f"  GA4: {Config.get_ga4_credentials_path()}")
    print(f"  Email: {Config.get_email_config_path()}")
    print()

    print("Directories:")
    print(f"  Data: {Config.get_data_dir()}")
    print(f"  Logs: {Config.get_logs_dir()}")
    print(f"  Reports: {Config.get_reports_dir()}")
    print()

    print("Environment:")
    print(f"  {Config.get_environment()}")
    print()

    try:
        Config.validate_setup(verbose=True)
    except ConfigError as e:
        print(f"\n❌ Validation failed: {e}")
